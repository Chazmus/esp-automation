# main.py -- Soil Moisture Sensor Node (Deep Sleep & GPIO-Power optimized)
import machine
import time
import secrets
import wifi
import homeassistant

print("\n========================================")
print(f"ESP32-C3 Soil Moisture Node: {secrets.DEVICE_NAME}")
print("========================================\n")

# --- Reset Cause check and Safeguard Delay ---
# If waking up from deep sleep, we skip the safeguard delay to save battery.
# Otherwise, we wait 5 seconds to allow the user to interrupt execution.
reset_cause = machine.reset_cause()
if reset_cause != machine.DEEPSLEEP_RESET:
    print("Cold boot or hard reset detected.")
    print("Safeguard: Waiting 5 seconds before starting WiFi/Sensor connection...")
    print("Press Ctrl+C in your REPL/Thonny to interrupt.")
    time.sleep(5)
else:
    print("Woke up from Deep Sleep. Optimizing for fast execution...")

# --- Pin Configuration ---
# Physical Wiring:
#   ESP32-C3 GND   -->  Soil Moisture Sensor GND
#   ESP32-C3 GPIO0 -->  Soil Moisture Sensor Analog Out (AO)
#   ESP32-C3 3.3V  -->  Soil Moisture Sensor VCC (Constant power)
#   OR
#   ESP32-C3 GPIO1 -->  Soil Moisture Sensor VCC (Power controlled via GPIO to save battery!)
ADC_PIN_NUMBER = 0       # GPIO0 supports ADC1_CH0
POWER_PIN_NUMBER = None  # Change to a GPIO pin number (e.g., 1) to enable power gating!

while True:
    # --- 1. Read Soil Moisture BEFORE WiFi (Avoids ADC noise & RF interference) ---
    moisture_percent = None
    raw_val = None
    power_pin = None

    # Turn on sensor if powered via GPIO
    if POWER_PIN_NUMBER is not None:
        try:
            print(f"⚡ Powering on soil moisture sensor via GPIO {POWER_PIN_NUMBER}...")
            power_pin = machine.Pin(POWER_PIN_NUMBER, machine.Pin.OUT)
            power_pin.value(1)
            # Wait for the sensor to stabilize (capacitive sensors need time to start their oscillator)
            time.sleep_ms(100)
        except Exception as e:
            print(f"⚠️ Error powering on sensor: {e}")

    try:
        print("Reading Soil Moisture Sensor...")
        adc_pin = machine.Pin(ADC_PIN_NUMBER)
        adc = machine.ADC(adc_pin)
        # Configure 11dB attenuation to read full 3.3V voltage range (0 - 3.3V)
        adc.atten(machine.ADC.ATTN_11DB)
        
        # Take multiple readings and average them to filter out ESP32 ADC noise
        readings = []
        for _ in range(5):
            readings.append(adc.read())
            time.sleep_ms(10)
        raw_val = sum(readings) // len(readings)
        
        # Convert to estimated moisture percentage (adjust these calibration values for your sensor)
        dry_value = 3000
        wet_value = 1200
        
        moisture_percent = 100 * (dry_value - raw_val) / (dry_value - wet_value)
        # Clamp percentage between 0% and 100%
        moisture_percent = max(0.0, min(100.0, moisture_percent))
        
        print(f"🌱 Measured Moisture: {moisture_percent:.1f}% (Raw ADC Average: {raw_val})")
    except Exception as e:
        print(f"⚠️ Error reading soil moisture sensor: {e}")
    finally:
        # Shut off power to the sensor immediately to save battery
        if power_pin is not None:
            try:
                print("⚡ Powering off soil moisture sensor...")
                power_pin.value(0)
                # Reconfigure pin as input/floating to prevent any back-powering or leakage
                power_pin = machine.Pin(POWER_PIN_NUMBER, machine.Pin.IN)
            except Exception as e:
                print(f"⚠️ Error powering off sensor: {e}")

    # Measure Battery Voltage & Percentage (Auto-detected)
    import battery
    bat_voltage = battery.read_voltage()
    bat_percent = battery.get_percentage(bat_voltage)
    if bat_voltage is not None:
        print(f"🔋 Battery: {bat_voltage:.2f}V ({bat_percent:.1f}%)")
    else:
        print("🔋 Battery sensing circuit not detected (or battery critically low). Skipping.")

    # --- 2. Connect to WiFi & Post State to Home Assistant ---
    if moisture_percent is not None:
        # Connect to WiFi
        wifi_connected = wifi.connect()
        
        if wifi_connected:
            try:
                # Post Soil Moisture
                homeassistant.post_device_sensor(
                    sensor_suffix="soil_moisture",
                    state_value=f"{moisture_percent:.1f}",
                    friendly_suffix="Soil Moisture",
                    unit_of_measurement="%",
                    device_class="humidity"
                )
                
                # Post Battery (if available)
                if bat_voltage is not None and bat_percent is not None:
                    homeassistant.post_device_sensor(
                        sensor_suffix="battery",
                        state_value=f"{bat_percent:.1f}",
                        friendly_suffix="Battery Percentage",
                        unit_of_measurement="%",
                        device_class="battery"
                    )
                    homeassistant.post_device_sensor(
                        sensor_suffix="battery_voltage",
                        state_value=f"{bat_voltage:.2f}",
                        friendly_suffix="Battery Voltage",
                        unit_of_measurement="V",
                        device_class="voltage"
                    )
            except Exception as e:
                print(f"⚠️ Failed to post to Home Assistant: {e}")
            finally:
                # Explicitly disconnect and turn off WiFi interface to shut down the radio cleanly
                try:
                    import network
                    wlan = network.WLAN(network.STA_IF)
                    wlan.active(False)
                    print("📶 WiFi interface shut down.")
                except Exception as e:
                    print(f"⚠️ Failed to disable WiFi: {e}")
        else:
            print("❌ WiFi connection failed. Skipping HA post.")
    else:
        print("⚠️ Skipping WiFi connection and HA post due to sensor read failure.")

    # --- 3. Enter Deep Sleep or standard sleep if USB connected ---
    # Configure deep sleep/loop duration (15 minutes = 900 seconds)
    sleep_seconds = 900

    import usb
    if usb.is_usb_connected():
        print(f"🔌 USB connection detected! Staying awake. Sleeping {sleep_seconds} seconds before next reading...")
        time.sleep(sleep_seconds)
        print("\n🔄 Starting next measurement cycle...")
    else:
        print(f"💤 Entering Deep Sleep for {sleep_seconds} seconds...")
        # Give serial buffer a moment to flush print output before sleeping
        time.sleep_ms(100)
        machine.deepsleep(sleep_seconds * 1000)
