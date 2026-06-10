# ESP32-C3 MicroPython Fleet Development Guide

Welcome to your modular, multi-board MicroPython workspace! This project is organized using a **Shared Core + Selective Deployment (Strategy 1)** architecture. 

This design allows you to maintain multiple different devices (such as a Temperature/Humidity sensor and a Soil Moisture monitor) in the same codebase while sharing common helper modules, libraries, and utilities.

---

## 📂 Project Structure

```text
├── .venv/                      # Host Python virtual environment (type stubs)
├── firmware/                   # MicroPython firmware binaries (.bin)
├── pyrightconfig.json          # Configuration for Neovim / Pyright LSP
├── README.md                   # This guide
│
├── lib/                        # SHARED core libraries (deployed to ALL boards)
│   ├── ahtx0.py                # Reusable AHT20 sensor driver
│   ├── homeassistant.py        # Client library to post data to Home Assistant REST API
│   ├── secrets.py.example      # Template for WiFi credentials (copy to secrets.py)
│   └── wifi.py                 # Shared connection utility (modem stability optimized)
│
├── devices/                    # INDIVIDUAL DEVICE NODE SCHEMAS
│   │
│   ├── temp_humidity/          # Device #1: Air Temperature & Humidity
│   │   ├── boot.py             # Startup configuration for Device 1
│   │   └── main.py             # Target script (imports ahtx0 and reads over I2C)
│   │
│   └── soil_moisture/          # Device #2: Analog Soil Moisture Monitor
│       ├── boot.py             # Startup configuration for Device 2
│       └── main.py             # Target script (reads from ADC pins)
│
└── scripts/                    # Workflow automation utilities
    ├── deploy.py               # Selective deployer (takes device target argument)
    ├── repl.py                 # Monitors board output & opens interactive REPL
    └── status.py               # Queries board metadata and active files
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
| **VCC** | Red | **3.3V** | Power supply |
| **GND** | Black | **GND** | Ground |
| **AO** (Analog Out) | Blue | **GPIO 0** | Analog input (ADC1_CH0) |

---

## 2. Workspace Helper Scripts

Host commands are located inside the `scripts/` directory. They are designed to auto-detect which USB port your ESP32-C3 is plugged into and automatically manage serial permissions.

### 📤 Deploy / Flash Selective Devices
To flash a specific device, pass the device directory name as an argument. The deployer will automatically copy all files inside `lib/` to `/lib/` on the board, upload the device's specific files to `/`, and soft-reset the processor:

```bash
# Deploy the Temperature & Humidity node
python3 scripts/deploy.py temp_humidity

# Deploy the Soil Moisture monitor
python3 scripts/deploy.py soil_moisture
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

## 3. Understanding the Shared Code Pattern

*   **`lib/`**: Contains core modules that can be imported by *any* device. When you run `python3 scripts/deploy.py <device>`, everything in `lib/` is placed inside the ESP32's `/lib/` folder. MicroPython's import subsystem automatically searches `/lib/` by default.
    *   *Example:* Inside `devices/temp_humidity/main.py`, you can run `import ahtx0` directly even though the library is kept in the shared folder!
*   **`devices/`**: Contains completely separate device configurations. They have their own `boot.py` and `main.py` files. They run as fully independent programs once deployed.

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

## 5. WiFi Configuration

Both the Temperature/Humidity and Soil Moisture devices are pre-configured to connect to WiFi on boot using a shared network module.

### 🔑 Credentials Setup
1. Copy the template secrets file:
   ```bash
   cp lib/secrets.py.example lib/secrets.py
   ```
2. Open the newly created [lib/secrets.py](file:///home/cbailey/workspace/esp-automation/lib/secrets.py) and fill in your WiFi details:
   ```python
   WIFI_SSID = "your-wifi-name"
   WIFI_PASSWORD = "your-wifi-password"
   ```
   *Note: [lib/secrets.py](file:///home/cbailey/workspace/esp-automation/lib/secrets.py) is ignored by Git to keep your network credentials secure.*

### 🛠️ Connection Stability Tuning
Under the hood, [lib/wifi.py](file:///home/cbailey/workspace/esp-automation/lib/wifi.py) is pre-configured with the following hardware adjustments for the ESP32-C3:
* **Modem Power Management (`pm=PM_NONE`)**: Disabled to prevent packet dropouts during the router's WPA2/WPA3 4-way handshake.
* **Reduced Transmit Power (`txpower=5`)**: Lowered to prevent current draw spikes from causing voltage brownouts and RF transceiver instability.
* **Country Code (`network.country('GB')`)**: Configured for local regulatory compliance and clean channel scanning.

### 📝 Usage in Code
To connect any new device node, simply import the helper at the top of your `main.py`:
```python
import wifi

# Connect on boot
wifi.connect()
```

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

### 📝 Usage in Code
Import the client library and call `post_state()`. The entity will be automatically created in Home Assistant on the first post.

```python
import homeassistant

# Post state to HA (this creates/updates 'sensor.esp32_temperature')
homeassistant.post_state(
    sensor_id="esp32_temperature",
    state_value=23.4,
    friendly_name="Living Room Temperature",
    unit_of_measurement="°C",
    device_class="temperature"
)
```

---

## 7. Deep Sleep & Battery Optimization

Both device nodes are optimized for long-term battery operation using an 18650 cell.

### 💤 Deep Sleep Behavior
* The nodes boot, read sensor data, connect to WiFi, post to Home Assistant, and then enter deep sleep for **15 minutes** (900 seconds).
* To prevent battery waste, the **5-second deployment safeguard delay** is only active on a cold boot or manual hardware reset (`machine.reset_cause() != machine.DEEPSLEEP_RESET`). Wakes from deep sleep start measurements instantly.

### 🔌 Battery-Saving GPIO Power-Gating (Soil Moisture)
Soil moisture sensors draw continuous current (~5mA) if wired directly to the 3.3V power rail. To prevent this, you can control the sensor's power via a GPIO pin:
1. Connect the sensor's **VCC** pin to **GPIO 1** instead of the 3.3V rail.
2. In [devices/soil_moisture/main.py](file:///home/cbailey/workspace/esp-automation/devices/soil_moisture/main.py), configure `POWER_PIN_NUMBER = 1`.
3. The board will automatically supply power to the sensor, wait for it to stabilize, take readings, and then float the pin during deep sleep, reducing sleep current to just a few microamps!

### 🔋 Battery Voltage & Percentage Sensing (Optional)
The system includes automatic battery monitoring that reads the 18650's voltage and calculates its remaining percentage:
1. **The Circuit:** Since the battery goes up to 4.2V but the ESP32-C3 ADC pins only read up to 3.3V, you must construct a **1:1 voltage divider** (e.g., using two **10kΩ** or **100kΩ** resistors). Connect the battery positive (`B+` or `OUT+` on the TP4056) to one resistor, Ground (`GND`) to the other, and connect their junction to **GPIO 3** (`ADC1_CH3`) on the ESP32-C3.
2. **Auto-Detection (Fallback):** The firmware automatically sets a weak internal pull-down on GPIO 3 during startup to check if the pin is floating. If the voltage divider is not wired up, the pin will read `0V`. The code will automatically detect this (< 2.5V total battery), print a clean message to the REPL, and **bypass battery telemetry safely** without breaking the rest of the sensor readings! Once a connection is detected, it disables the internal pull-down to guarantee that its internal resistance doesn't skew your resistor divider ratio.
3. **Home Assistant:** If connected, the battery percentage (`sensor.esp32_<device>_battery`) and voltage (`sensor.esp32_<device>_battery_voltage`) will be posted on every cycle.

### 📡 Debugging a Sleeping Node
When a board is in deep sleep, it cannot accept programming/debugging commands. To flash new code or connect to the REPL, we have an **Auto-USB Host Detection Safeguard**:

1. **Auto-Detect USB Connection (Recommended):**
   If the ESP32-C3 is connected to an active USB host (like your computer), it automatically detects the USB connection via the hardware registers and skips deep sleep entirely. This keeps the REPL fully accessible and lets you deploy code easily at any time.

2. **Manual Reset Safeguard (Fallback):**
   If the auto-detect does not trigger (e.g., if you are powering it through a passive power source but want to connect), press the physical **EN / RST** button on the ESP32-C3 board to reset it. Run your deployment command or open the REPL during the **5-second safeguard delay** before the board attempts to sleep:
   ```bash
   python3 scripts/deploy.py temp_humidity
   ```

