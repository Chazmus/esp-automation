# ESP32-C3 MicroPython Fleet Development Guide

Welcome to your modular, multi-board MicroPython workspace! This project is organized using a **Modular, Config-Driven Architecture (Approach 2 + 3)**.

Instead of maintaining duplicated loops and helper logic on each device, all execution logic, driver communication, WiFi management, and Home Assistant synchronization are housed in the shared core library ([lib/](file:///home/cbailey/workspace/esp-automation/lib/)). Individual devices under `devices/` are defined purely by configuration parameters in a `config.py` file, keeping the target scripts clean and maintainable.

---

## 📂 Project Structure

```text
├── .venv/                      # Host Python virtual environment (type stubs)
├── .github/workflows/          # CI/CD GitHub Actions workflows
├── firmware/                   # MicroPython firmware binaries (.bin)
├── pyrightconfig.json          # Configuration for Neovim / Pyright LSP
├── README.md                   # This guide
│
├── lib/                        # SHARED core libraries (deployed to ALL boards)
│   ├── app.py                  # Unified execution engine (main runner loop)
│   ├── battery.py              # Battery telemetry and voltage monitoring
│   ├── homeassistant.py        # Client library to post data to Home Assistant REST API
│   ├── usb.py                  # Auto-USB connection detection helper
│   ├── wifi.py                 # WiFi manager (modem stability & connection-retention optimized)
│   ├── secrets.py.example      # Template for credentials (copy to secrets.py)
│   │
│   └── drivers/                # Unified hardware driver classes
│       ├── ahtx0.py            # Raw AHT10/AHT20 driver dependency
│       ├── temp_humidity.py    # Abstraction for AHT10/AHT20 sensors
│       ├── soil_moisture.py    # Abstraction for capacitive soil moisture sensors
│       ├── fan.py              # PWM-based fan controller
│       └── relay.py            # Simple digital GPIO on/off relay controller
│
├── devices/                    # INDIVIDUAL DEVICE NODE SCHEMAS
│   │
│   ├── temp_humidity/          # Device #1: Air Temperature & Humidity Node
│   │   ├── boot.py             # Startup configuration for Device 1
│   │   ├── config.py           # Configuration parameters (pinouts, intervals)
│   │   └── main.py             # Bootstrapper (delegates execution to lib.app)
│   │
│   ├── grow_wardrobe/          # Device #2: Multi-sensor & Multi-actuator Controller
│   │   ├── boot.py             # Startup configuration (starts WebREPL server)
│   │   ├── config.py           # Configuration parameters (sensors, fan, relay pins)
│   │   ├── ha_card.yaml        # Home Assistant dashboard card configuration template
│   │   ├── main.py             # Bootstrapper (delegates execution to lib.app)
│   │   └── README.md           # Documentation specific to grow wardrobe
│   │
│   └── cam-test/                # Device #3: ESP32-CAM live feed + Home Assistant integration (ESPHome, not MicroPython)
│       ├── esphome/cam-test.yaml         # ESPHome config: camera, WiFi, HA API
│       ├── esphome/secrets.yaml.example  # WiFi/API key/OTA credentials template
│       ├── ha_timelapse_automation.yaml    # HA automation: periodic snapshots
│       ├── ha_timelapse_shell_command.yaml # HA shell_command: compile snapshots to mp4
│       ├── platformio.ini       # Raw Arduino MJPEG test (pre-ESPHome fallback), pinned to Arduino-ESP32 2.x core
│       ├── src/main.cpp         # Raw Arduino MJPEG test: WiFi + OV2640 stream server, no HA integration
│       ├── include/camera_pins.h    # AI-Thinker pin mapping (used by the raw test)
│       ├── include/secrets.h.example # WiFi credentials template (used by the raw test)
│       └── README.md            # Wiring, flashing, HA setup & timelapse instructions
│
├── scripts/                    # Host workflow automation utilities
│   ├── deploy.py               # Selective deployer (copies shared core & configures board)
│   ├── repl.py                 # Monitors board output & opens interactive REPL
│   ├── status.py               # Queries board metadata and active files
│   └── webrepl_cli.py          # Command line tool for remote OTA file syncs
│
└── tests/                      # Pytest unit testing suite (simulates MicroPython stack)
    ├── test_app.py             # Tests the unified main execution engine
    ├── test_battery.py         # Tests battery measurement calculations
    ├── test_homeassistant.py   # Tests HA integration REST API payloads
    └── test_wifi.py            # Tests WiFi status translations
```

---

## 1. Physical Device Wiring Diagrams

### Device 1: Temperature & Humidity Sensor (AHT20)
Uses **I2C communication** on default pins:

| AHT20 Sensor Pin | Wire Color (suggested) | ESP32-C3 Pin | Purpose |
| :--- | :--- | :--- | :--- |
| **VIN / VCC** | Red | **3.3V** | Power supply (do not use 5V) |
| **GND** | Black | **GND** | Ground |
| **SDA** (Serial Data) | Yellow | **GPIO 5** | I2C Serial Data line |
| **SCL** (Serial Clock)| White | **GPIO 6** | I2C Serial Clock line |

---

### Device 2: Soil Moisture Monitor (Analog ADC)
Uses **Analog input (ADC)** to read soil resistance:

| Soil Moisture Pin | Wire Color (suggested) | ESP32-C3 Pin | Purpose |
| :--- | :--- | :--- | :--- |
| **VCC** | Red | **3.3V** (or **GPIO 1** for power gating) | Power supply |
| **GND** | Black | **GND** | Ground |
| **AO** (Analog Out) | Blue | **GPIO 0** | Analog input (ADC1_CH0) |

---

## 2. Workspace Helper Scripts

Host commands are located inside the `scripts/` directory. They are designed to auto-detect which USB port your ESP32-C3 is plugged into and automatically manage serial permissions.

### 📤 Deploy / Flash Selective Devices
To flash a specific device, pass the device directory name as an argument. The deployer will automatically copy all files inside `lib/` to `/lib/` on the board, upload the files inside the device's directory (such as `main.py`, `boot.py`, and renaming `config.py` to root `/config.py`), and soft-reset the processor:

```bash
# Deploy the Temperature & Humidity node
python3 scripts/deploy.py temp_humidity

# Deploy the Grow Wardrobe controller
python3 scripts/deploy.py grow_wardrobe
```

*If you do not provide an argument, the deployer will print a list of all available device folders in your project.*

### 💻 Connect to interactive Python REPL
Launches you directly into the interactive MicroPython command line (REPL) running on the chip without soft-resetting:
```bash
python3 scripts/repl.py
```
*(Remember: Press `Ctrl + ]` to exit the REPL).*

### 🔍 Check Board Status
Queries the connected microcontroller's system information and lists all active files on its internal filesystem:
```bash
python3 scripts/status.py
```

---

## 3. How the Config-Driven Pattern Works

### Root Bootstrapper
For all devices, `main.py` is identical and extremely clean:
```python
import config
from lib.app import run

run(config)
```

### Device Configuration (`config.py`)
Each board specifies its physical characteristics, attached peripherals, and execution settings. 

For instance, the **Temperature & Humidity Node** ([devices/temp_humidity/config.py](file:///home/cbailey/workspace/esp-automation/devices/temp_humidity/config.py)):
```python
import secrets

DEVICE_NAME = secrets.DEVICE_NAME
DEEP_SLEEP_ENABLED = True
SLEEP_SECONDS = 900 # Sleep 15 mins

TEMP_HUMIDITY_SENSOR = {
    "sda": 5,
    "scl": 6,
    "type": "AHT20"
}
SOIL_MOISTURE_SENSOR = None
```

Whereas the complex **Grow Wardrobe Node** ([devices/grow_wardrobe/config.py](file:///home/cbailey/workspace/esp-automation/devices/grow_wardrobe/config.py)):
```python
import secrets

DEVICE_NAME = secrets.DEVICE_NAME
DEEP_SLEEP_ENABLED = False  # Continuous execution
SLEEP_SECONDS = 10         # Cycle interval

TEMP_HUMIDITY_SENSOR = {
    "sda": 5,
    "scl": 6,
    "type": "AHT10"
}
SOIL_MOISTURE_SENSOR = {
    "adc_pin": 0,
    "dry": 3800,
    "wet": 1275,
    "power_pin": None,
    "num_samples": 5
}
PWM_FAN = {
    "pin": 12,
    "freq": 25000,
    "target_temp": 28.0
}
LIGHT_RELAY = {
    "pin": 13
}
```

---

## 4. Host Setup & IDE LSP Integration

### 🐍 Python Environment Setup
To set up your python environment on the host and install all required tools (`esptool`, `mpremote`, and MicroPython autocompletion stubs):

```bash
# Create the virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```
*(Run `deactivate` to exit the environment).*

Once installed, your editor's LSP (like Pyright/Basedpyright in LazyVim) will read the configured `pyrightconfig.json` to resolve the shared `lib/` folder and offer full autocompletion, type hinting, and zero warnings across all folders!

### 🔌 Running Without Sudo (Serial Port Permissions)
If you encounter permission issues when interacting with the serial port, add your user to the appropriate group (usually `uucp` on Arch or `dialout` on Debian/Ubuntu):

```bash
# Add user to uucp group (or dialout)
sudo usermod -aG uucp $USER
```
*Note: You will need to log out and log back in (or run `newgrp uucp`) for the group changes to take effect.*

---

## 5. WiFi Configuration & OTA WebREPL

### 🔑 Credentials Setup
1. Copy the template secrets file:
   ```bash
   cp lib/secrets.py.example lib/secrets.py
   ```
2. Open the newly created [lib/secrets.py](file:///home/cbailey/workspace/esp-automation/lib/secrets.py) and fill in your WiFi details and credentials:
   ```python
   WIFI_SSID = "your-wifi-name"
   WIFI_PASSWORD = "your-wifi-password"
   WEBREPL_PASSWORD = "your-webrepl-password"
   ```
   *Note: [lib/secrets.py](file:///home/cbailey/workspace/esp-automation/lib/secrets.py) is ignored by Git to keep your network credentials secure.*

### 📡 Always-On vs. Deep Sleep WiFi Logic
* **Always-On Nodes (e.g., Grow Wardrobe):** The firmware maintains a persistent WiFi network stack and avoids active interface toggles between measurement cycles. This prevents WebREPL connections from dropping, keeping remote REPL control and OTA updates stable.
* **Deep Sleep Nodes (e.g., Temperature & Humidity):** To minimize power consumption, the WiFi radio is actively shut down (`wlan.active(False)`) immediately after posting telemetry data, before the device enters hardware sleep mode.

---

## 6. Home Assistant Integration

This project includes a shared client module **`lib/homeassistant.py`** to post data directly to Home Assistant's REST API.

### 🔑 Setup
1. Generate a **Long-Lived Access Token** in your Home Assistant profile settings.
2. In [lib/secrets.py](file:///home/cbailey/workspace/esp-automation/lib/secrets.py), configure `HA_URL` (use your Home Assistant server's local IP address instead of `.local`) and `HA_TOKEN`:
   ```python
   HA_URL = "http://192.168.86.X:8123"
   HA_TOKEN = "your-long-lived-access-token"
   ```

Telemetry payloads are automatically structured and posted inside [lib/app.py](file:///home/cbailey/workspace/esp-automation/lib/app.py) using the configured `DEVICE_NAME` prefix. The entities are created in Home Assistant on the first successful telemetry post.

---

## 7. Deep Sleep & Battery Optimization

### 💤 Deep Sleep Behavior
* For nodes with `DEEP_SLEEP_ENABLED = True`, the board boots, reads the sensors, connects to WiFi, posts to Home Assistant, and then enters deep sleep.
* To prevent battery waste, the **5-second deployment safeguard delay** is only active on a cold boot or manual hardware reset (`machine.reset_cause() != machine.DEEPSLEEP_RESET`). Waking from deep sleep triggers sensor read cycles instantly.

### 🔌 Battery-Saving GPIO Power-Gating (Soil Moisture)
Soil moisture sensors draw continuous current if wired directly to the 3.3V power rail. To prevent this, you can configure a `power_pin` in your sensor dictionary:
1. Connect the sensor's **VCC** pin to **GPIO 1** instead of the 3.3V rail.
2. In your device's config dictionary, set `"power_pin": 1`.
3. The board will automatically supply power to the sensor, wait for it to stabilize, take readings, and then float the pin during deep sleep, reducing sleep current to just a few microamps!

### 🔋 Battery Voltage & Percentage Sensing (Optional)
The system includes automatic battery monitoring that reads the 18650's voltage and calculates its remaining percentage:
1. **The Circuit:** Construct a **1:1 voltage divider** (using two **10kΩ** or **100kΩ** resistors). Connect the battery positive to one resistor, Ground (`GND`) to the other, and connect their junction to **GPIO 3** (`ADC1_CH3`) on the ESP32-C3.
2. **Auto-Detection:** The firmware automatically checks the voltage on GPIO 3 during startup. If the voltage divider is not wired up (< 2.5V), it prints a clean message to the REPL, and **bypasses battery telemetry safely** without breaking the rest of the sensor readings.
