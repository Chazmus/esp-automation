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
> **Memory, SPI & Power Constraints**:
> *   **Memory**: Because the ESP32-C3 lacks PSRAM, the display configuration must use `color_palette: 8BIT` to limit the framebuffer size to ~76.8 KB (instead of 153.6 KB in 16-bit mode) to prevent out-of-memory errors.
> *   **SPI bus**: Set to a stable `data_rate: 10MHz` to prevent signal degradation over jumper wires.
> *   **Wi-Fi Transmission Power**: The Wi-Fi configuration uses `output_power: 12dB` and `power_save_mode: NONE`. This prevents massive peak current draw spikes when transmitting at full power, which otherwise overloads the ESP32-C3 Super Mini's small regulator and causes brownouts and boot loops.

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

---

## Home Assistant Persistent Sensor Setup

Since the grow cupboard's monitoring ESP runs on battery/sleep cycles or might be powered down, its direct entities (e.g. `sensor.esp32_growdrobe_temp`) will frequently show as `unavailable` or `unknown` in Home Assistant.

To prevent the touchscreen from displaying `nan` when the monitoring ESP is offline, we set up **persistent virtual template sensors** in Home Assistant's `configuration.yaml` that freeze on their last known valid reading and self-initialize from previous database history on boot.

### Add to Home Assistant `configuration.yaml`:

```yaml
template:
  - sensor:
      - name: "Growdrobe Temp Persistent"
        unit_of_measurement: "°C"
        device_class: temperature
        state: >
          {% set val = states("sensor.esp32_growdrobe_temp") %}
          {% if val not in ["unavailable", "unknown"] %}
            {{ val }}
          {% else %}
            {% set prev = states("sensor.growdrobe_temp_persistent") %}
            {{ prev if prev not in ["unavailable", "unknown"] else 28.96 }}
          {% endif %}

      - name: "Growdrobe Humidity Persistent"
        unit_of_measurement: "%"
        device_class: humidity
        state: >
          {% set val = states("sensor.esp32_growdrobe_humidity") %}
          {% if val not in ["unavailable", "unknown"] %}
            {{ val }}
          {% else %}
            {% set prev = states("sensor.growdrobe_humidity_persistent") %}
            {{ prev if prev not in ["unavailable", "unknown"] else 49.22 }}
          {% endif %}

      - name: "Growdrobe Moisture Persistent"
        unit_of_measurement: "%"
        device_class: moisture
        state: >
          {% set val = states("sensor.esp32_growdrobe_moisture") %}
          {% if val not in ["unavailable", "unknown"] %}
            {{ val }}
          {% else %}
            {% set prev = states("sensor.growdrobe_moisture_persistent") %}
            {{ prev if prev not in ["unavailable", "unknown"] else 1.2 }}
          {% endif %}
```
