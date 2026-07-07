# main.py -- Grow Wardrobe Automation (Always Powered / No Deep Sleep)
import machine
import time
import secrets
import wifi
import homeassistant
import ahtx0

print("\n========================================")
print(f"ESP32-C3 Grow Wardrobe Node: {secrets.DEVICE_NAME}")
print("========================================\n")

# Since this node is plugged in all the time, we run a continuous loop
# and do NOT enter deep sleep.

# --- Pin Mapping & Configurations ---
# I2C configuration for AHT20 (using default SDA=Pin 5, SCL=Pin 6)
try:
    i2c = machine.I2C(0, sda=machine.Pin(5), scl=machine.Pin(6), freq=100000)
    # AHT20 has a fixed address 0x38
    temp_humidity_sensor = ahtx0.AHT10(i2c)
    print("✅ AHT20 Temperature/Humidity sensor initialized successfully.")
except Exception as e:
    temp_humidity_sensor = None
    print(f"⚠️ Error initializing AHT20: {e}")

# Soil Moisture Sensor (Capacitive HW-390) configuration on GPIO 0
try:
    moisture_pin = machine.Pin(0)
    moisture_adc = machine.ADC(moisture_pin)
    # Set 11dB attenuation to read full 0 - 3.3V range
    moisture_adc.atten(machine.ADC.ATTN_11DB)
    print("✅ HW-390 Soil Moisture Sensor initialized successfully on GPIO 0.")
except Exception as e:
    moisture_adc = None
    print(f"⚠️ Error initializing soil moisture sensor: {e}")

# TODO: 3. 1x Fan Speed Control (PWM pin)
# TODO: 4. 1x Relay for Light (GPIO pin)


cycle_count = 0

while True:
    cycle_count += 1
    print(f"\n--- Cycle #{cycle_count} ---")
    
    # 1. Read AHT20 Temperature/Humidity Sensor
    if temp_humidity_sensor is not None:
        try:
            temp = temp_humidity_sensor.temperature
            humidity = temp_humidity_sensor.relative_humidity
            print(f"🌡️  Measured: Temp={temp:.2f} °C, Humidity={humidity:.2f} %")
        except Exception as e:
            print(f"⚠️ Error reading AHT20 sensor: {e}")
            temp, humidity = None, None
    else:
        print("⚠️ Temperature/Humidity sensor not initialized. Retrying initialization...")
        try:
            temp_humidity_sensor = ahtx0.AHT10(i2c)
            temp = temp_humidity_sensor.temperature
            humidity = temp_humidity_sensor.relative_humidity
            print(f"🌡️  Measured: Temp={temp:.2f} °C, Humidity={humidity:.2f} %")
        except Exception as e:
            print(f"⚠️ Initialization retry failed: {e}")
            temp, humidity = None, None
            
    # 2. Read Capacitive Soil Moisture Sensor (HW-390)
    raw_moisture = None
    moisture_pct = None
    if moisture_adc is not None:
        try:
            raw_moisture = moisture_adc.read()
            # Calibration constants: 3800 = Dry (0%), 1275 = Wet (100%)
            dry_val = 3800
            wet_val = 1275
            moisture_pct = ((dry_val - raw_moisture) / (dry_val - wet_val)) * 100
            moisture_pct = max(0.0, min(100.0, moisture_pct))
            print(f"🌱 Soil Moisture: {moisture_pct:.1f}% (Raw: {raw_moisture})")
        except Exception as e:
            print(f"⚠️ Error reading soil moisture sensor: {e}")
    else:
        print("⚠️ Soil moisture sensor not initialized.")

    # TODO: Adjust fan speed PWM duty cycle based on temperature
    
    # Send measurements to Home Assistant
    wlan = wifi.network.WLAN(wifi.network.STA_IF)
    if wlan.isconnected():
        try:
            print("Syncing measurements with Home Assistant...")
            # 1. Post Temperature
            if temp is not None:
                homeassistant.post_device_sensor(
                    sensor_suffix="temp",
                    state_value=f"{temp:.2f}",
                    friendly_suffix="Temperature",
                    unit_of_measurement="°C",
                    device_class="temperature"
                )
            # 2. Post Humidity
            if humidity is not None:
                homeassistant.post_device_sensor(
                    sensor_suffix="humidity",
                    state_value=f"{humidity:.2f}",
                    friendly_suffix="Humidity",
                    unit_of_measurement="%",
                    device_class="humidity"
                )
            # 3. Post Soil Moisture
            if moisture_pct is not None:
                homeassistant.post_device_sensor(
                    sensor_suffix="moisture",
                    state_value=f"{moisture_pct:.1f}",
                    friendly_suffix="Soil Moisture",
                    unit_of_measurement="%",
                    device_class="humidity"
                )
        except Exception as e:
            print(f"⚠️ Home Assistant sync error: {e}")
    else:
        print("⚠️ WiFi not connected. Skipping HA update.")
        # Attempt to reconnect if connection dropped
        wifi.connect()
        
    # Wait 10 seconds using small cooperative sleep intervals so WebREPL remains responsive
    for _ in range(100):
        time.sleep_ms(100)
