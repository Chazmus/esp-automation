# ESP Automation Developer & Agent Guide

This repository manages a fleet of ESP32-C3 microcontrollers running MicroPython, connected to Home Assistant over MQTT.

---

## 🏗️ Architecture Overview

- **Core Library (`lib/`)**: Shared drivers (AHT20, relays, PWM fans, soil moisture), controllers (VPD PI controller, irrigation state machine), and network helpers (`wifi.py`, `umqtt/simple.py`).
- **Device Modules (`devices/<device>/`)**: Device-specific configurations (`config.py`), boot scripts (`boot.py`), and runtimes (`main.py`).
- **Host Tools (`scripts/`)**: Tools for local USB flashing, remote WebREPL flashing, and REPL access.

---

## 📱 Known Devices & Network Configuration

### 1. `grow_wardrobe` (Grow Wardrobe Controller)
- **Role**: Environmental control (VPD fan speed PI loop) and 3-pump irrigation (drip, agitation, runoff drain).
- **IP Address**: Configured via `DEVICE_IP` in [devices/grow_wardrobe/config.py](file:///home/chaz_bailey/workspace/esp-automation/devices/grow_wardrobe/config.py) or `lib/secrets.py`.
- **WebREPL**: Port `8266`, password stored in `lib/secrets.py` (`WEBREPL_PASSWORD`).
- **MQTT Base Topic**: `wardrobe`
- **MQTT Client ID**: `esp32_growdrobe`
- **Modes**: Strictly `AUTO` and `MANUAL` (no `DRY` mode).

---

## 🚀 Deployment Workflows

### 1. Remote WebREPL Deployment (Over WiFi)
To flash an ESP32 connected to WiFi without needing a USB cable:
```bash
# Automatically uses DEVICE_IP configured in devices/<device>/config.py:
python3 scripts/deploy.py grow_wardrobe --remote

# Or explicitly specifying an IP:
python3 scripts/deploy.py grow_wardrobe --ip <ip_address>
```
*Note: If no USB device is connected, `deploy.py` automatically falls back to the configured `DEVICE_IP`.*

The deployer will:
1. Sync all shared libraries from `lib/` to `/lib/` on the board.
2. Sync device-specific files (`main.py`, `config.py`, `boot.py`) to the board's root directory `/`.
3. Trigger a clean hardware reset (`machine.reset()`) via WebREPL to execute the new code.

### 2. Local USB Deployment
When the board is plugged into the computer via USB:
```bash
python3 scripts/deploy.py grow_wardrobe
```
Auto-detects `/dev/ttyACM*` or `/dev/ttyUSB*` and uses `mpremote`.

---

## 🏠 Home Assistant Integration

### SSH Access
Home Assistant is accessible from this host via SSH:
```bash
ssh root@homeassistant
```
- Configuration directory: `/homeassistant/` (symlinked from `/config`).
- Configuration file: `/homeassistant/configuration.yaml`.
- Supervisor CLI: `ha` (e.g. `ha core check`, `ha core restart`, `ha apps logs core_mosquitto`).

### MQTT Best Practices & Conventions
1. **Retain Rules**:
   - **State topics (`.../state`) MUST be published with `retain=True`**:
     Ensures that Home Assistant, Lovelace cards, and reconnecting clients always reflect the true state immediately on startup.
   - **Command topics (`.../set`) MUST have `retain=False`**:
     Never retain `/set` messages. If retained, the broker will replay stale commands when the ESP reconnects, unintentionally overriding startup states.
2. **Entity Definitions (`configuration.yaml`)**:
   - `select.ventilation_mode`: options `["AUTO", "MANUAL"]`.
   - `select.irrigation_mode`: options `["AUTO", "MANUAL"]`.
3. **Validating & Reloading**:
   - Validate syntax: `ssh root@homeassistant "ha core check"`.
   - Reload MQTT entities: Developer Tools → YAML → Manually configured MQTT entities (or `ssh root@homeassistant "ha core restart"`).

---

## 🧪 Testing

Run pytest with `PYTHONPATH=.`:
```bash
PYTHONPATH=. pytest
```
All unit tests are located under `tests/`.
