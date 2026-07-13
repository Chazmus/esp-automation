# ESP32-CAM Live Feed & Timelapse Implementation Plan

This guide outlines **Option A (Home Assistant Centric)** for integrating an ESP32-CAM module inside the Grow Wardrobe. This setup provides a live camera stream on your Home Assistant dashboard and automatically captures and saves snapshots to compile a plant growth timelapse video.

---

## 1. Hardware Requirements & Wiring

* **Board:** **ESP32-CAM (AI-Thinker module)** with an OV2640 camera sensor.
* **Power Supply:** A dedicated **5V micro-USB adapter** capable of supplying at least **2A**. 
  > [!IMPORTANT]
  > ESP32-CAM modules draw high current spikes (~350mA) when initializing the camera, connecting to WiFi, or writing to flash. Powering it directly from a basic USB serial converter or low-quality power supply will cause brownouts and boot loops.
* **FTDI USB-to-TTL Adapter:** Needed initially to flash the board, as the ESP32-CAM does not have an onboard USB port.

### FTDI to ESP32-CAM Flash Wiring

| FTDI Adapter Pin | ESP32-CAM Pin | Purpose |
| :--- | :--- | :--- |
| **VCC (set to 5V)** | **5V** | Main power input |
| **GND** | **GND** | Ground reference |
| **RX** | **TX (GPIO 1)** | Serial Transmit |
| **TX** | **RX (GPIO 3)** | Serial Receive |
| **-** | **Jump GPIO 0 to GND** | **Flash Mode** (Remove jumper after flashing to run) |

---

## 2. Step 1: ESPHome Configuration

Create an ESPHome configuration file (e.g. `wardrobe_camera.yaml`) using the following template:

```yaml
esphome:
  name: wardrobe-camera
  friendly_name: Wardrobe Camera

esp32:
  board: esp32dev
  framework:
    type: arduino

wifi:
  ssid: "your-wifi-ssid"
  password: "your-wifi-password"

# Native Home Assistant Integration
api:
  encryption:
    key: "your-noise-encryption-key"

ota:
  platform: esphome

# Pinout configuration for AI-Thinker ESP32-CAM boards
esp32_camera:
  name: Wardrobe Live Feed
  external_clock:
    pin: GPIO0
    frequency: 20MHz
  i2c_pins:
    sda: GPIO26
    scl: GPIO27
  data_pins: [GPIO5, GPIO18, GPIO19, GPIO21, GPIO36, GPIO39, GPIO34, GPIO35]
  vsync_pin: GPIO25
  href_pin: GPIO23
  pixel_clock_pin: GPIO22
  power_down_pin: GPIO32
  reset_pin: GPIO-1 # Reset pin tied to system reset
  
  # Image parameters
  resolution: 800x600 # Higher resolutions (1024x768, 1600x1200) available but reduce framerate
  jpeg_quality: 10
  vertical_flip: true
  horizontal_mirror: false
```

Deploy the YAML code via ESPHome. The board will expose a `camera.wardrobe_live_feed` entity to Home Assistant.

---

## 3. Step 2: Home Assistant Snapshot Automation

To capture the timelapse frames, configure Home Assistant to record snapshots periodically.

### A. Enable Local Folder Writing
Add the target folder to your `allowlist_external_dirs` in your Home Assistant `configuration.yaml` file so the service has permission to write images:

```yaml
homeassistant:
  allowlist_external_dirs:
    - /config/www/timelapse
```
*Create the `/config/www/timelapse/` directory on your HA host and restart Home Assistant.*

### B. Create Snapshot Automation
Add this automation to Home Assistant to take a snapshot every 30 minutes.

```yaml
alias: "Wardrobe Growth Timelapse Snapshot"
description: "Takes a snapshot of the wardrobe camera feed every 30 minutes to record growth."
trigger:
  - platform: time_pattern
    minutes: "/30"
condition:
  # Optional: only take snapshots during daylight hours (e.g. 7 AM to 9 PM)
  - condition: time
    after: "07:00:00"
    before: "21:00:00"
action:
  - service: camera.snapshot
    target:
      entity_id: camera.wardrobe_live_feed
    data:
      # Saves the files sequentially using timestamp filenames
      filename: "/config/www/timelapse/plant_{{ now().strftime('%Y%m%d_%H%M%S') }}.jpg"
mode: single
```

---

## 4. Step 3: Compiling the Video (Post-Processing)

At the end of your plant's growth cycle, you can compile the saved images into an `mp4` video.

### Option A: Using FFmpeg on your local PC (Recommended)
Download the `timelapse` directory from your Home Assistant server to your PC, open a terminal in that folder, and run:

```bash
ffmpeg -framerate 30 -pattern_type glob -i '*.jpg' -c:v libx264 -pix_fmt yuv420p output_timelapse.mp4
```

#### Command breakdown:
* `-framerate 30`: Renders the output at 30 frames per second.
* `-pattern_type glob -i '*.jpg'`: Selects all JPEG files alphabetically (timestamps ensure correct order).
* `-c:v libx264`: Encodes using the widely compatible H.264 video codec.
* `-pix_fmt yuv420p`: Sets pixel format to YUV420p for compatibility with default players (QuickTime, Windows Media Player, browsers).

### Option B: Automatic compilation via Home Assistant Shell Command
You can automate the compilation on the Home Assistant server itself by declaring a Shell Command in HA's `configuration.yaml`:

```yaml
shell_command:
  compile_timelapse: >-
    ffmpeg -y -framerate 24 -pattern_type glob -i '/config/www/timelapse/*.jpg' -c:v libx264 -pix_fmt yuv420p -vf "scale=800:-2" /config/www/timelapse/grow_timelapse.mp4
```
This script can then be triggered manually or via an automation scheduled once a week. The output video is stored under `/config/www/timelapse/grow_timelapse.mp4` and is accessible inside Home Assistant under the URL `https://your-ha-instance/local/timelapse/grow_timelapse.mp4`.
