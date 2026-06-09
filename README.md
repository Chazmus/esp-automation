# ESP32-C3 MicroPython Development Guide

Welcome to your ESP32-C3 MicroPython development workspace! This project is organized with a clean directory structure to separate your application code, firmware, and utility scripts.

---

## 📂 Project Structure

```text
├── firmware/              # MicroPython firmware binaries (.bin)
├── pyrightconfig.json     # Configuration for Pyright LSP
├── README.md              # This guide
├── scripts/               # Host system helper scripts for flashing/monitoring
│   ├── deploy.sh          # Syncs src/ files to board and soft-resets
│   ├── repl.sh            # Starts an interactive REPL
│   └── status.sh          # Checks port, chip, and lists uploaded files
└── src/                   # Python application files running on the ESP32
    ├── boot.py            # Executed first on boot
    └── main.py            # Executed second (main loop / program code)
```

---

## 1. Board Discovery & Port Access

On Linux, your ESP32-C3 board with native USB-Serial/JTAG support is detected as:
*   **Device name:** `Espressif USB JTAG/serial debug unit`
*   **Port path:** `/dev/ttyACM0` (or similar)

### Fixing USB Permissions (Crucial Step)
By default, standard users on Linux do not have read/write access to serial ports. To fix this permanently:

1. Add your user to the `dialout` group:
   ```bash
   sudo usermod -aG dialout $USER
   ```
2. **Log out of your Linux session and log back in** (or restart your machine) for the changes to take effect.

> **Note:** For the current session, or if you encounter permission errors, your helper scripts will automatically run with `sudo` where necessary, so you can start developing right away!

---

## 2. Flashing MicroPython

The latest stable MicroPython firmware (`v1.28.0`) is stored in:
`firmware/ESP32_GENERIC_C3-20260406-v1.28.0.bin`

If you ever need to re-flash or flash another board, run these commands:

### Step A: Erase the Existing Flash
```bash
esptool --chip esp32c3 --port /dev/ttyACM0 erase-flash
```

### Step B: Write the MicroPython Firmware
```bash
esptool --chip esp32c3 --port /dev/ttyACM0 --baud 460800 write-flash -z 0x0 firmware/ESP32_GENERIC_C3-20260406-v1.28.0.bin
```

---

## 3. Workspace Helper Scripts

We have provided three automated, auto-port-detecting utility scripts inside the `scripts/` folder to make your host workflow seamless:

### 🔍 Check Board Status
Automatically detects which USB port your ESP32-C3 is plugged into, queries its chip architecture/details, and lists all files currently uploaded to its flash:
```bash
./scripts/status.sh
```

### 📤 Deploy / Flash Files
Auto-detects the active port, uploads both `src/boot.py` and `src/main.py` onto the ESP32-C3, and triggers a soft reset to immediately run your new code:
```bash
./scripts/deploy.sh
```

### 💻 Connect to interactive Python REPL
Auto-detects the port and launches you directly into the interactive MicroPython command line (REPL) running on the chip:
```bash
./scripts/repl.sh
```
*(Remember: Press `Ctrl + ]` to exit the REPL and return to your terminal).*

---

## 4. Understanding the Python Application (`src/`)

*   **`src/boot.py`**: This script runs once when the board powers up or resets. It is typically used for low-level configuration, disabling system logs, or setting up a Wi-Fi connection.
*   **`src/main.py`**: This script runs automatically immediately after `boot.py` finishes. It contains your main application loop.

### Configuring your LED inside `src/main.py`
Many ESP32-C3 dev boards have different onboard LEDs. Inside `src/main.py`, you can configure the behavior to suit your board:
*   **Standard Single Color LED:** (e.g., ESP32-C3 Super Mini). Keep `USE_NEOPIXEL = False` and set `LED_PIN_NUMBER = 8`.
*   **Addressable WS2812/NeoPixel RGB LED:** (e.g., Espressif DevKitC/DevKitM). Set `USE_NEOPIXEL = True` and set `LED_PIN_NUMBER` to the appropriate GPIO (usually `8` or `2`).

---

## 5. IDE / Neovim / LazyVim LSP Setup

To prevent LSPs (like Pyright/Basedpyright) from complaining about missing imports (like `machine` or `neopixel`), a Python virtual environment has been set up with the **`micropython-esp32-stubs`** package.

Additionally, a **`pyrightconfig.json`** file is configured in the project root to:
1. Target the local virtual environment (`.venv`).
2. Point Pyright to analyze only the `src/` directory.
3. Suppress missing source file warnings (`reportMissingModuleSource: "none"`).

### Activating the Virtual Environment
To work inside this environment on your terminal:
```bash
source .venv/bin/activate
```
*(Run `deactivate` to exit).*

When you open Neovim/LazyVim from this folder, your LSP will automatically detect the virtual environment, resolve the MicroPython stubs, and provide full autocompletion, type hinting, and error-free imports!
