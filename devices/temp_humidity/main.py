# main.py -- Temperature & Humidity Sensor Node (Deep Sleep optimized)
import machine
import time
import secrets
import wifi
import homeassistant

print("\n========================================")
print(f"ESP32-C3 Temp/Humidity Node: {secrets.DEVICE_NAME}")
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

# Physical Wiring:
#   ESP32-C3 3.3V  -->  AHT20 VIN / VCC
#   ESP32-C3 GND   -->  AHT20 GND
#   ESP32-C3 GPIO5 -->  AHT20 SDA (Serial Data)
#   ESP32-C3 GPIO6 -->  AHT20 SCL (Serial Clock)

while True:
    # --- 1. Initialize Sensor & Read Data BEFORE WiFi (Avoids Self-heating & RF noise) ---
    i2c = None
    sensor = None
    temp = None
    humidity = None

    try:
        print("Initializing AHT20 Sensor...")
        i2c = machine.I2C(0, sda=machine.Pin(5), scl=machine.Pin(6), freq=100000)
        
        # Give the sensor a tiny moment to wake up/initialize if needed
        time.sleep_ms(50)
        
        import ahtx0
        sensor = ahtx0.AHT20(i2c)
        temp = sensor.temperature
        humidity = sensor.relative_humidity
        print(f"🌡️  Measured: Temp={temp:.2f} °C, Humidity={humidity:.2f} %")
    except Exception as e:
        print(f"⚠️  Error reading AHT20 sensor: {e}")

    # Measure Battery Voltage & Percentage (Auto-detected)
    import battery
    bat_voltage = battery.read_voltage()
    bat_percent = battery.get_percentage(bat_voltage)
    if bat_voltage is not None:
        print(f"🔋 Battery: {bat_voltage:.2f}V ({bat_percent:.1f}%)")
    else:
        print("🔋 Battery sensing circuit not detected (or battery critically low). Skipping.")

    # --- 2. Connect to WiFi & Post State to Home Assistant ---
    if temp is not None and humidity is not None:
        # Connect to WiFi
        wifi_connected = wifi.connect()
        
        if wifi_connected:
            try:
                # Post Temperature
                homeassistant.post_state(
                    sensor_id=f"esp32_{secrets.DEVICE_NAME}_temp",
                    state_value=f"{temp:.2f}",
                    friendly_name=f"ESP32 {secrets.DEVICE_NAME} Temperature",
                    unit_of_measurement="°C",
                    device_class="temperature"
                )
                # Post Humidity
                homeassistant.post_state(
                    sensor_id=f"esp32_{secrets.DEVICE_NAME}_humidity",
                    state_value=f"{humidity:.2f}",
                    friendly_name=f"ESP32 {secrets.DEVICE_NAME} Humidity",
                    unit_of_measurement="%",
                    device_class="humidity"
                )
                
                # Post Battery (if available)
                if bat_voltage is not None and bat_percent is not None:
                    homeassistant.post_state(
                        sensor_id=f"esp32_{secrets.DEVICE_NAME}_battery",
                        state_value=f"{bat_percent:.1f}",
                        friendly_name=f"ESP32 {secrets.DEVICE_NAME} Battery Percentage",
                        unit_of_measurement="%",
                        device_class="battery"
                    )
                    homeassistant.post_state(
                        sensor_id=f"esp32_{secrets.DEVICE_NAME}_battery_voltage",
                        state_value=f"{bat_voltage:.2f}",
                        friendly_name=f"ESP32 {secrets.DEVICE_NAME} Battery Voltage",
                        unit_of_measurement="V",
                        device_class="voltage"
                    )
            except Exception as e:
                print(f"⚠️  Failed to post to Home Assistant: {e}")
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
