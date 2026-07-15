# Grow Wardrobe Touchscreen Dashboard

This directory contains the ESPHome configuration, wiring schematics, and setup instructions for the **TFT SPI Touchscreen Dashboard** powered by an **ESP32-C3 Super Mini**.

The touchscreen serves as a physical control interface and live status display on the front of the Grow Wardrobe. It interfaces directly with Home Assistant to fetch states and call services.

---

## Hardware Configuration

- **Microcontroller:** [ESP32-C3 Super Mini](https://randomnerdtutorials.com/esp32-c3-super-mini/) (320 KB SRAM, no PSRAM)
- **Display Module:** 2.8" SPI TFT LCD with Touch Controller (`KMRTM28028-SPI`)
  - **Display Controller:** ILI9341 (320x240 resolution)
  - **Touch Controller:** XPT2046 (resistive touch)

> [!IMPORTANT]
> **Memory & SPI Constraints**: Because the ESP32-C3 lacks PSRAM, the display configuration must use `color_palette: 8BIT` to limit the framebuffer size to ~76.8 KB (instead of 153.6 KB in 16-bit mode), which prevents out-of-memory errors and screen artifacts. Additionally, the SPI bus is set to a stable `data_rate: 10MHz` to prevent signal degradation over jumper wires.

---

## Wiring Pin Mapping

Due to the limited number of GPIO pins on the ESP32-C3 Super Mini, the SPI bus is shared between the Display and Touch controllers, and the screen's hardware **RESET** is mapped to **GPIO 1** for software-controlled reset during boot.

| Screen Pin | ESP32-C3 Pin | Description | SPI Role / Function |
| :--- | :--- | :--- | :--- |
| **VCC** | `5V` or `3V3` | Power Supply (5V recommended for brightness) | Power |
| **GND** | `GND` | Ground | Ground |
| **CS** | `GPIO 7` | Display Chip Select (active low) | SPI Display CS |
| **RESET** | `GPIO 1` | Display Reset (software-controlled) | Software Reset |
| **DC/RS** | `GPIO 10` | Data / Command register | Control Pin |
| **SDI (MOSI)**| `GPIO 6` | SPI Data Input (shared) | SPI MOSI |
| **SCK** | `GPIO 4` | SPI Clock (shared) | SPI Clock |
| **LED** | `3V3` | Backlight Power (tie to 3V3 for always-on brightness) | Backlight |
| **SDO (MISO)**| `GPIO 5` | SPI Data Output (shared) | SPI MISO |
| **T_CLK** | `GPIO 4` | Touch Clock (shared) | SPI Clock |
| **T_CS** | `GPIO 0` | Touch Chip Select (active low) | SPI Touch CS |
| **T_DIN** | `GPIO 6` | Touch Data Input (shared) | SPI MOSI |
| **T_DO** | `GPIO 5` | Touch Data Output (shared) | SPI MISO |
| **T_IRQ** | `GPIO 3` | Touch Interrupt Pin | Touch Interrupt |

---

## Initial Setup & Flashing

1. **Configure Local Secrets**:
   Copy the `secrets.yaml.example` to `secrets.yaml` inside the `esphome/` directory and configure your network details:
   ```bash
   cp esphome/secrets.yaml.example esphome/secrets.yaml
   ```
   Open `esphome/secrets.yaml` and update the parameters with your Wi-Fi SSID, Password, Home Assistant API key, and desired OTA password.

2. **Booting the ESP32-C3 Super Mini**:
   If the board does not automatically enter boot/flashing mode when connected via USB:
   - Press and hold the **BOOT** button (labeled on the board near the USB connector).
   - Press and release the **RESET** button (or short `EN` to `GND`).
   - Release the **BOOT** button.
   - The device should now be ready for flashing.

3. **Compile and Upload**:
   Compile and upload the configuration using the ESPHome CLI:
   ```bash
   esphome run esphome/wardrobe_touchscreen.yaml
   ```

4. **Calibrating Touch Coordinates**:
   After flashing, watch the ESPHome serial logs. Tapping the screen will print logs like:
   `Touch detected at x=..., y=..., x_raw=..., y_raw=...`
   
   To calibrate your resistive screen:
   - Tap the top-left corner and note down the raw coordinates.
   - Tap the bottom-right corner and note down the raw coordinates.
   - Adjust `calibration.x_min`, `calibration.x_max`, `calibration.y_min`, and `calibration.y_max` in [wardrobe_touchscreen.yaml](file:///home/chaz_bailey/workspace/esp-automation/devices/wardrobe_touchscreen/esphome/wardrobe_touchscreen.yaml) accordingly.
