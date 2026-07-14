# wardrobe_camera: ESP32-CAM Live Feed

An ESP32-CAM (AI-Thinker, OV2640) running [ESPHome](https://esphome.io/),
exposing a `camera.wardrobe_camera_wardrobe_live_feed` entity to Home Assistant
and driving a snapshot-based timelapse.

This device is **not** part of the MicroPython fleet used by the rest of
`devices/`. Mainline MicroPython has no reliable OV2640 camera driver, so
this uses ESPHome (Arduino framework under the hood) instead. Everything
lives self-contained inside `devices/wardrobe_camera/`.

The directory also still contains `src/main.cpp` / `platformio.ini`: a raw
PlatformIO/Arduino sketch that serves a bare MJPEG stream with no Home
Assistant integration at all. That was the very first smoke test to confirm
the camera hardware and WiFi worked before moving to ESPHome — keep it
around as a quick fallback if you ever need to sanity-check the board
outside of Home Assistant (see "Appendix: Raw MJPEG Test" below).

---

## 1. Hardware & Wiring

* **Board:** ESP32-CAM (AI-Thinker module) with OV2640 sensor.
* **Power:** Dedicated 5V/2A micro-USB (or bench) supply. The camera draws
  high current spikes on init; a weak/shared supply causes brownout boot
  loops.
* **FTDI USB-to-TTL adapter:** required to flash — the board has no
  onboard USB.

| FTDI Adapter Pin | ESP32-CAM Pin | Purpose |
| :--- | :--- | :--- |
| **VCC (set to 5V)** | **5V** | Main power input |
| **GND** | **GND** | Ground reference |
| **RX** | **TX (GPIO 1)** | Serial Transmit |
| **TX** | **RX (GPIO 3)** | Serial Receive |
| **-** | **Jump GPIO 0 to GND** | Flash mode (remove jumper after flashing, then power-cycle to run) |

---

## 2. Setup

1. Install ESPHome into the repo's venv (already done if you ran the
   top-level setup): `pip install esphome`.
2. Copy the secrets template and fill in your WiFi credentials, plus a
   generated API encryption key and OTA password:

   ```bash
   cp devices/wardrobe_camera/esphome/secrets.yaml.example devices/wardrobe_camera/esphome/secrets.yaml
   python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
   ```

   Paste the generated key in as `api_encryption_key`. `secrets.yaml` is
   git-ignored, matching how `lib/secrets.py` is handled for the
   MicroPython devices.

---

## 3. Flash & Run

**First flash (USB, board in flash mode):**

```bash
cd devices/wardrobe_camera/esphome
esphome upload wardrobe_camera.yaml --device /dev/ttyUSB0
```

Put the board into flash mode first (jumper GPIO 0 to GND on a bare FTDI
adapter, or hold the flash button on an ESP32-CAM-MB programmer board)
before running the upload. Once it finishes, take the board out of flash
mode and press reset (or power-cycle it) to boot normally.

**Later updates (OTA, once the device is on the network):**

```bash
cd devices/wardrobe_camera/esphome
esphome upload wardrobe_camera.yaml
```

ESPHome will find `wardrobe-camera.local` automatically and push the update over
WiFi — no USB cable needed after the first flash.

### View Serial Output (first boot only)

Opening the serial port can itself hold the ESP32 in reset via the
DTR/RTS lines on some adapters. If `esphome logs` hangs, read the port
directly with DTR/RTS explicitly released:

```bash
python3 -c "
import serial, time
ser = serial.Serial()
ser.port = '/dev/ttyUSB0'
ser.baudrate = 115200
ser.timeout = 1
ser.dtr = False
ser.rts = False
ser.open()
ser.dtr = False
ser.rts = False
end = time.time() + 30
while time.time() < end:
    line = ser.readline()
    if line:
        print(line.decode(errors='replace').rstrip())
ser.close()
"
```

You should see it join WiFi and print its IP address, e.g. `IP Address:
192.168.86.46`.

---

## 4. Add to Home Assistant

1. **Settings → Devices & Services** — Home Assistant should auto-discover
   `wardrobe-camera` on the network. If not, add the **ESPHome** integration
   manually and point it at `wardrobe-camera.local` (or its IP).
2. When prompted, enter the `api_encryption_key` value from
   `esphome/secrets.yaml`.
3. The device exposes a camera entity (in this setup:
   `camera.wardrobe_camera_wardrobe_live_feed`) — add it to a dashboard view to
   see the live feed.

Consider reserving the board's IP (MAC address is logged on boot) in your
router's DHCP settings so `wardrobe-camera.local` doesn't need to keep re-resolving
if mDNS is flaky on your network.

---

## 5. Timelapse Capture

Two Home Assistant config snippets in this directory build on the
snapshot-automation approach from
[docs/camera_timelapse_plan.md](../../docs/camera_timelapse_plan.md):

* **[ha_timelapse_automation.yaml](ha_timelapse_automation.yaml)** — takes
  a snapshot from `camera.wardrobe_camera_wardrobe_live_feed` every 30 minutes
  (7 AM–9 PM) and saves it under
  `/config/www/timelapse/wardrobe_camera/`.
* **[ha_timelapse_shell_command.yaml](ha_timelapse_shell_command.yaml)** —
  a `shell_command` that compiles the saved frames into
  `/config/www/timelapse/wardrobe_camera/wardrobe_camera_timelapse.mp4` via `ffmpeg`.

**Before using either:** add `/config/www/timelapse` to
`allowlist_external_dirs` in Home Assistant's `configuration.yaml` (see
step 3A of the plan doc) and restart Home Assistant, otherwise the
snapshot service will silently refuse to write files.

Paste the automation into **Settings → Automations → Edit in YAML**, and
merge the `shell_command:` block into `configuration.yaml`. Trigger the
compile step manually via **Developer Tools → Actions →
`shell_command.compile_wardrobe_camera_timelapse`** whenever you want a fresh
video.

---

## 6. Notes

* Frame size/quality is set in `esphome/wardrobe_camera.yaml` (currently
  800x600/SVGA, JPEG quality 10). The board has 8MB of PSRAM, confirmed
  in the boot log, so higher resolutions are available if needed.
* `esphome/wardrobe_camera.yaml` disables the `reset_pin` entry entirely —
  AI-Thinker boards tie camera reset to the system reset line, and ESPHome
  rejects `-1` as an explicit pin number (unlike the raw Arduino sketch,
  which uses `RESET_GPIO_NUM -1` directly against the esp32-camera C API).

---

## Appendix: Raw MJPEG Test

`src/main.cpp` / `platformio.ini` are the original bare-metal Arduino test
used to confirm the camera + WiFi worked, before any Home Assistant
integration existed. It serves a live MJPEG stream directly (no HA, no
snapshots) at `http://<device-ip>/`.

```bash
cp devices/wardrobe_camera/include/secrets.h.example devices/wardrobe_camera/include/secrets.h
# fill in WIFI_SSID / WIFI_PASSWORD in secrets.h, then:
cd devices/wardrobe_camera
pio run --target upload
```

Board goes into flash mode the same way as above. After flashing, reset
the board and open `http://<printed-ip>/` in a browser — the serial log
prints the IP once it's on the network.
