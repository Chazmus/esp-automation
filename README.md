# ESP32-C3 MicroPython Fleet Development Guide

Welcome to your modular, multi-board MicroPython workspace! This project is organized using a **Modular, Config-Driven Architecture**.

Instead of maintaining duplicated loops and helper logic on each device, all execution logic, driver communication, WiFi management, and Home Assistant synchronization are housed in the shared core library ([lib/](lib/)). Individual devices under [devices/](devices/) are defined by device-specific configurations (`config.py`), boot scripts (`boot.py`), and runtimes (`main.py`), keeping code clean and maintainable.

---

## 1. Physical Device Wiring Diagrams

### Grow Wardrobe Controller (`grow_wardrobe`)
The controller coordinates multi-zone environmental sensing, closed-loop PWM ventilation, and a 3-pump irrigation/drainage system.

#### A. Environmental Sensors (I2C / SoftI2C)
Since AHT20 sensors share a fixed I2C address (`0x38`), three independent SoftI2C buses are configured:

| Sensor Zone | Sensor Type | SDA Pin | SCL Pin | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Canopy** | AHT20 | **GPIO 5** | **GPIO 6** | Primary feedback for temperature, RH & calculated VPD |
| **Pot Level** | AHT20 | **GPIO 7** | **GPIO 8** | Microclimate detection at pot/soil surface |
| **Ambient Intake** | AHT20 | **GPIO 9** | **GPIO 10**| Feedforward baseline for venting differential |

#### B. Soil Moisture Sensor (Analog ADC)
| Sensor Pin | Wire Color (suggested) | ESP32-C3 Pin | Purpose |
| :--- | :--- | :--- | :--- |
| **VCC** | Red | **3.3V** (or **GPIO 1** for power gating) | Power supply |
| **GND** | Black | **GND** | Ground |
| **AO** (Analog Out) | Blue | **GPIO 0** | Analog input (ADC1_CH0) |

#### C. Actuators & Relays (Pumps & Ventilation)
| Output Device | Control Pin | Voltage / Type | Purpose |
| :--- | :--- | :--- | :--- |
| **Noctua NF-A14 Fan** | **GPIO 1** | 12V (25 kHz PWM) | Variable speed extraction fan |
| **Relay Channel 1** | **GPIO 2** | 12V DC Pump | Fresh nutrient drip irrigation |
| **Relay Channel 2** | **GPIO 3** | 12V DC Diaphragm | Runoff waste vacuum pump |
| **Relay Channel 3** | **GPIO 4** | 12V DC Pump | Reservoir agitation / nutrient aeration |
| **Relay Channel 4** | **GPIO 20**| Spare Relay | Unassigned / auxiliary |

*(Note: The grow light is switched via an external Home Assistant smart plug to ensure 240V AC mains isolation).*

---

## 2. Workspace Helper Scripts

Host commands are located inside the [`scripts/`](scripts/) directory.

### 📤 1. Deploy / Flash Devices

#### Remote WebREPL Deployment (Over WiFi)
To flash an ESP32 connected to your local network without plugging in a USB cable:
```bash
# Uses the DEVICE_IP configured in devices/<device>/config.py:
python3 scripts/deploy.py grow_wardrobe --remote

# Or explicitly specifying an IP address:
python3 scripts/deploy.py grow_wardrobe --ip 192.168.86.50
```
*The deployer syncs all shared libraries in `lib/` to `/lib/`, syncs device files to `/`, and soft-resets the MCU via WebREPL.*

#### Local USB Deployment
When the board is connected via USB:
```bash
python3 scripts/deploy.py grow_wardrobe
```
*Auto-detects `/dev/ttyACM*` or `/dev/ttyUSB*` and uses `mpremote`.*

### 💻 2. Interactive MicroPython REPL
Launches directly into the interactive MicroPython command line (REPL) on the chip:
```bash
python3 scripts/repl.py
```
*(Press `Ctrl + ]` to exit the REPL).*

### 🔍 3. Check Board Status
Queries the connected microcontroller's system information and lists active files on its internal filesystem:
```bash
python3 scripts/status.py
```

---

## 3. How the Config-Driven Pattern Works

### Device Configuration (`config.py`)
Each board specifies its physical characteristics, attached peripherals, and execution settings.

Example from [devices/grow_wardrobe/config.py](devices/grow_wardrobe/config.py):
```python
import secrets

DEVICE_NAME = secrets.DEVICE_NAME
DEEP_SLEEP_ENABLED = False  # Continuous execution
SLEEP_SECONDS = 5          # Main loop cycle interval

# Multi-zone temperature/humidity sensors
TEMP_HUMIDITY_CANOPY = {"sda": 5, "scl": 6, "type": "AHT20"}
TEMP_HUMIDITY_POT = {"sda": 7, "scl": 8, "type": "AHT20"}
TEMP_HUMIDITY_AMBIENT = {"sda": 9, "scl": 10, "type": "AHT20"}

# Analog soil moisture
SOIL_MOISTURE_SENSOR = {
    "adc_pin": 0,
    "dry": 3800,
    "wet": 1275,
    "power_pin": None,
    "num_samples": 5
}

# 25 kHz PWM Fan
PWM_FAN = {
    "pin": 1,
    "freq": 25000,
    "min_duty": 10,
    "max_duty": 100,
}

# 4-Channel Relays
RELAYS = {
    "irrigation": {"pin": 2, "active_low": True},
    "runoff":     {"pin": 3, "active_low": True},
    "agitation":  {"pin": 4, "active_low": True},
    "spare":      {"pin": 20, "active_low": True},
}
```

---

## 4. Host Setup & IDE LSP Integration

### 🐍 Python Environment Setup
```bash
# Create the virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

Once installed, your editor's LSP (Pyright, Basedpyright, or Ruff) will read `pyrightconfig.json` to resolve the shared `lib/` folder and offer full autocompletion, type hinting, and zero warnings.

### 🔌 Serial Port Permissions (Linux)
If you encounter permission issues interacting with the serial port, add your user to `uucp` (Arch) or `dialout` (Debian/Ubuntu):
```bash
sudo usermod -aG dialout $USER  # or: sudo usermod -aG uucp $USER
```
*(Log out and back in for group changes to take effect).*

---

## 5. WiFi Configuration & Secrets

1. Copy the template secrets file:
   ```bash
   cp lib/secrets.py.example lib/secrets.py
   ```
2. Open [lib/secrets.py](lib/secrets.py) and configure your network details:
   ```python
   WIFI_SSID = "your-wifi-name"
   WIFI_PASSWORD = "your-wifi-password"
   WEBREPL_PASSWORD = "your-webrepl-password"
   MQTT_BROKER = "192.168.86.X"
   MQTT_USER = "your-mqtt-user"
   MQTT_PASSWORD = "your-mqtt-password"
   ```
   *Note: `lib/secrets.py` is ignored by Git to keep credentials secure.*

---

## 6. Home Assistant & MQTT Integration

The system communicates with Home Assistant using **MQTT** (`wardrobe/...` topics) and optional REST API (`lib/homeassistant.py`).

### MQTT Best Practices & Conventions
1. **Retain Rules**:
   - **State topics (`.../state`) MUST have `retain=True`**: Ensures Home Assistant and reconnecting dashboards immediately reflect the current state on startup.
   - **Command topics (`.../set`, `.../trigger`) MUST have `retain=False`**: Prevents the MQTT broker from replaying stale commands when the microcontroller reboots.
2. **Key Entities**:
   - `select.ventilation_mode`: options `["AUTO", "MANUAL"]`.
   - `select.irrigation_mode`: options `["AUTO", "MANUAL"]`.
   - `sensor.esp32_growdrobe_canopy_temp`, `sensor.esp32_growdrobe_canopy_humidity`, `sensor.esp32_growdrobe_vpd`.

---

## 7. Frontend Web Dashboard

The repository includes a modern React/Tailwind web dashboard located in [`frontend/grow_wardrobe/`](frontend/grow_wardrobe/README.md).

### Quick Commands
```bash
cd frontend/grow_wardrobe

# Development server
npm run dev

# Run test suite
npm test -- --run

# Build production bundle
npm run build

# Deploy to Home Assistant (/homeassistant/www/grow_wardrobe/)
npm run deploy
```

---

## 8. Automated Testing

### Backend & MicroPython Tests
Run unit tests with pytest from the repository root:
```bash
PYTHONPATH=. pytest
```

### Frontend Dashboard Tests
Run Vitest tests in the frontend directory:
```bash
cd frontend/grow_wardrobe && npm test -- --run
```

---

## 9. Companion Devices

- **[Grow Wardrobe Web Dashboard](frontend/grow_wardrobe/README.md)**: Real-time telemetry, fan dynamics, dual-medium irrigation scheduling, and photoperiod timeline visualization.
- **[Wardrobe Touchscreen Panel](devices/wardrobe_touchscreen/README.md)**: 2.8" SPI color touchscreen powered by an ESP32-C3 Super Mini running ESPHome.
- **[Wardrobe Camera Node](devices/wardrobe_camera/README.md)**: ESP32-CAM module streaming live video and recording growth timelapses.
