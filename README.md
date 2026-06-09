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
│   └── ahtx0.py                # Reusable AHT20 sensor driver
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
    ├── deploy.sh               # Selective deployer (takes device target argument)
    ├── repl.sh                 # Monitors board output & opens interactive REPL
    └── status.sh               # Queries board metadata and active files
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
./scripts/deploy.sh temp_humidity

# Deploy the Soil Moisture monitor
./scripts/deploy.sh soil_moisture
```

*If you do not provide an argument, the deployer will print a list of all available device folders in your project.*

### 💻 Connect to interactive Python REPL
Launches you directly into the interactive MicroPython command line (REPL) running on the chip without soft-resetting:
```bash
./scripts/repl.sh
```
*(Remember: Press `Ctrl + ]` to exit the REPL).*

### 🔍 Check Board Status
Queries the connected microcontroller's system information and lists all active files on its internal filesystem:
```bash
./scripts/status.sh
```

---

## 3. Understanding the Shared Code Pattern

*   **`lib/`**: Contains core modules that can be imported by *any* device. When you run `./scripts/deploy.sh <device>`, everything in `lib/` is placed inside the ESP32's `/lib/` folder. MicroPython's import subsystem automatically searches `/lib/` by default.
    *   *Example:* Inside `devices/temp_humidity/main.py`, you can run `import ahtx0` directly even though the library is kept in the shared folder!
*   **`devices/`**: Contains completely separate device configurations. They have their own `boot.py` and `main.py` files. They run as fully independent programs once deployed.

---

## 4. IDE / Neovim / LazyVim LSP Integration

To prevent LSPs (like Pyright/Basedpyright) from showing red warnings when your device-specific `main.py` imports code from the shared `lib/` directory, **`pyrightconfig.json`** is pre-configured with `"extraPaths": ["lib"]`.

### Activating the Virtual Environment on Host
To enable autocompletion on your host shell or editor:
```bash
source .venv/bin/activate
```
*(Run `deactivate` to exit).*

When you open LazyVim inside this project, the LSP will seamlessly resolve your MicroPython stubs, resolve shared library imports, and offer full autocompletion, type hinting, and zero warnings across all folders!
