# Touchscreen Dashboard Implementation Plan

This document outlines the architecture, hardware, wiring, and software setup for adding a dedicated SPI TFT Touchscreen to the front of the Grow Wardrobe. 

The screen acts as a physical control panel and live telemetry dashboard. It operates as a separate node running **ESPHome**, querying device states from **Home Assistant** and sending touch controls back to trigger wardrobe automations.

---

## 1. System Architecture

```text
  [ Wardrobe Controller ]             [ Touchscreen Dashboard ]
     (MicroPython Node)                     (ESPHome Node)
             │                                     ▲
             ▼ (Telemetry)                         │ (Pulls states & sends clicks)
   ┌────────────────────────────────────────────────────────┐
   │                    Home Assistant                      │
   │           (Single Source of Truth / Server)            │
   └────────────────────────────────────────────────────────┘
```

1. **Grow Wardrobe Controller (MicroPython)** measures temperature, humidity, and soil moisture, then posts them to Home Assistant.
2. **Home Assistant** hosts the entity states:
   * `sensor.esp32_grow_wardrobe_temp`
   * `sensor.esp32_grow_wardrobe_humidity`
   * `sensor.esp32_grow_wardrobe_moisture`
   * `switch.grow_wardrobe_light`
   * `fan.grow_wardrobe_fan`
3. **Touchscreen Dashboard (ESPHome)** connects to Home Assistant, imports the wardrobe's sensor values to display them, and sends service calls (like light toggle or fan speed adjustments) back to Home Assistant when the screen is touched.

---

## 2. Hardware Specifications

* **Microcontroller:** **ESP32-S3** (highly recommended over ESP32-C3 for display nodes due to its higher pin count, dual-core speed, and larger RAM/Flash, which are critical for loading fonts, images, and smooth touch transitions).
* **Display Panel:** 2.8" or 3.2" SPI TFT LCD Display (typical resolution `240x320`).
  * **Display Controller:** **ILI9341** or **ST7789** (extensively supported in ESPHome).
  * **Touch Controller:** **XPT2046** resistive touch chip.
* **Alternative (All-in-One Board):** A **CYD (Cheap Yellow Display)** board, which has an ESP32-S3, an ILI9341 display, and an XPT2046 touch controller pre-soldered and integrated on a single PCB for ~$10-15.

---

## 3. Recommended Pin Mapping (ESP32-S3 to SPI Display)

If using a standalone ESP32-S3 and display board, use the following wiring scheme. SPI lines (`MOSI`, `MISO`, `SCLK`) can be shared between the display and the touchscreen controllers, using separate Chip Select (`CS`) pins to distinguish them.

| Screen Pin | ESP32-S3 GPIO | Description | SPI Role |
| :--- | :--- | :--- | :--- |
| **VCC** | 3.3V / 5V | Screen power supply | Power |
| **GND** | GND | Ground reference | Ground |
| **CS** | GPIO 4 | Display Chip Select | Display Select |
| **RESET** | GPIO 48 | Display Reset (or tied to ESP EN) | Reset |
| **D/C** (RS) | GPIO 5 | Data / Command register | Control |
| **SDI (MOSI)**| GPIO 11 | SPI Data input to screen | SPI MOSI |
| **SCK** | GPIO 12 | SPI Clock | SPI Clock |
| **LED** | GPIO 6 | Backlight brightness (PWM) | Backlight |
| **SDO (MISO)**| GPIO 13 | SPI Data output (from touch screen) | SPI MISO |
| **T_CLK** | GPIO 12 | Touch Clock (shared) | SPI Clock |
| **T_CS** | GPIO 7 | Touch Controller Chip Select | Touch Select |
| **T_DIN** | GPIO 11 | Touch Data in (shared) | SPI MOSI |
| **T_OUT** | GPIO 13 | Touch Data out (shared) | SPI MISO |
| **T_IRQ** | GPIO 15 | Touch Interrupt (optional) | Interrupt |

---

## 4. ESPHome Software Configuration

Below is a complete, working draft template of the ESPHome YAML configuration file (`wardrobe_display.yaml`) for this dashboard.

```yaml
esphome:
  name: wardrobe-display
  friendly_name: Wardrobe Touchscreen Dashboard

esp32:
  board: esp32-s3-devkitc-1
  framework:
    type: esp-idf

wifi:
  ssid: "your-wifi-ssid"
  password: "your-wifi-password"

# Natively bind to Home Assistant
api:
  encryption:
    key: "your-noise-encryption-key"

ota:
  platform: esphome

# 1. Share SPI Bus between Display and Touch Controllers
spi:
  clk_pin: GPIO12
  mosi_pin: GPIO11
  miso_pin: GPIO13

# 2. Configure Display Driver (ILI9341)
display:
  - platform: ili9341
    id: wardrobe_tft
    cs_pin: GPIO4
    dc_pin: GPIO5
    reset_pin: GPIO48
    rotation: 90
    pages:
      - id: main_page
        lambda: |-
          // Title
          it.print(10, 10, id(font_large), "Grow Wardrobe Control");
          it.line(10, 35, 310, 35, id(color_white));
          
          // Telemetry states (imported from Home Assistant)
          it.printf(20, 60, id(font_medium), "Air Temp: %.1f °C", id(ha_temp).state);
          it.printf(20, 95, id(font_medium), "Humidity: %.1f %%", id(ha_humidity).state);
          it.printf(20, 130, id(font_medium), "Soil Moisture: %.1f %%", id(ha_moisture).state);

          // Relay state
          if (id(ha_light_switch).state) {
            it.print(20, 175, id(font_medium), "Lights: ON", id(color_green));
          } else {
            it.print(20, 175, id(font_medium), "Lights: OFF", id(color_red));
          }

          // Simple touch target buttons visual boxes
          it.rectangle(180, 55, 120, 50, id(color_white));
          it.print(200, 70, id(font_small), "Toggle Fan");

          it.rectangle(180, 115, 120, 50, id(color_white));
          it.print(195, 130, id(font_small), "Toggle Light");

# 3. Configure Touch Driver (XPT2046)
touchscreen:
  platform: xpt2046
  id: wardrobe_touch
  cs_pin: GPIO7
  interrupt_pin: GPIO15
  update_interval: 50ms
  threshold: 400
  calibration_x_min: 300
  calibration_x_max: 3800
  calibration_y_min: 250
  calibration_y_max: 3900
  # Map coordinates to Touch Actions
  on_touch:
    - lambda: |-
        // touch coordinate logging
        ESP_LOGI("touch", "Touch detected at x=%d, y=%d", touch.x, touch.y);
        
        // Touch Target 1: Toggle Fan (Region: x 180-300, y 55-105)
        if (touch.x >= 180 && touch.x <= 300 && touch.y >= 55 && touch.y <= 105) {
          id(toggle_fan_action).execute();
        }
        // Touch Target 2: Toggle Light (Region: x 180-300, y 115-165)
        if (touch.x >= 180 && touch.x <= 300 && touch.y >= 115 && touch.y <= 165) {
          id(toggle_light_action).execute();
        }

# 4. Pull Live Sensor States from Home Assistant
sensor:
  - platform: homeassistant
    id: ha_temp
    entity_id: sensor.esp32_grow_wardrobe_temp
    
  - platform: homeassistant
    id: ha_humidity
    entity_id: sensor.esp32_grow_wardrobe_humidity

  - platform: homeassistant
    id: ha_moisture
    entity_id: sensor.esp32_grow_wardrobe_moisture

# 5. Pull Switch States from Home Assistant
binary_sensor:
  - platform: homeassistant
    id: ha_light_switch
    entity_id: switch.grow_wardrobe_light

# 6. Action handlers sending commands back to Home Assistant
script:
  - id: toggle_fan_action
    mode: restart
    then:
      - homeassistant.service:
          service: homeassistant.toggle
          data:
            entity_id: fan.grow_wardrobe_fan
            
  - id: toggle_light_action
    mode: restart
    then:
      - homeassistant.service:
          service: homeassistant.toggle
          data:
            entity_id: switch.grow_wardrobe_light

# Fonts and Colors for rendering
font:
  - file: "gfonts://Roboto"
    id: font_large
    size: 20
  - file: "gfonts://Roboto"
    id: font_medium
    size: 16
  - file: "gfonts://Roboto"
    id: font_small
    size: 14

color:
  - id: color_white
    red: 100%
    green: 100%
    blue: 100%
  - id: color_green
    red: 0%
    green: 100%
    blue: 0%
  - id: color_red
    red: 100%
    green: 0%
    blue: 0%
```

---

## 5. Next Steps for Implementation

1. **Hardware Selection:** Buy an ESP32-S3 Development Board (e.g. Freenove or Espressif DevKit) or a Cheap Yellow Display (CYD) board.
2. **ESPHome Setup:** Install the ESPHome dashboard in Home Assistant, create a new device, and copy/paste this configuration, updating the WiFi credentials and API key.
3. **Calibrating Touch Coordinates:** Flash the code and monitor the ESPHome logs via the web or USB. Tap the corners of the screen to read your display's raw X/Y output, then adjust the `calibration_x_min`, `calibration_x_max` etc., in the YAML configuration to align the touch inputs precisely.
