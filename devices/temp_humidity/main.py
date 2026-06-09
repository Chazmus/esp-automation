# main.py -- put your code here!
import machine
import time

print("\n========================================")
print("Hello, ESP32-C3 World from MicroPython!")
print("========================================\n")

# --- Deployment Safeguard ---
# A brief delay at startup gives host tools (like mpremote or Thonny) 
# a clean window to interrupt execution and connect to the REPL.
print("Starting main loop in 2 seconds... Press Ctrl+C to cancel.")
time.sleep(2)

# --- WiFi Connection ---
import wifi
wifi.connect()

# --- I2C & AHT20 Sensor Configuration ---
# Physical Wiring:
#   ESP32-C3 3.3V  -->  AHT20 VIN / VCC
#   ESP32-C3 GND   -->  AHT20 GND
#   ESP32-C3 GPIO5 -->  AHT20 SDA (Serial Data)
#   ESP32-C3 GPIO6 -->  AHT20 SCL (Serial Clock)
i2c = None
sensor = None

try:
    print("\nInitializing I2C Bus on SDA=GPIO5, SCL=GPIO6...")
    i2c = machine.I2C(0, sda=machine.Pin(5), scl=machine.Pin(6), freq=100000)
    devices = i2c.scan()
    print(f"I2C Scan results: {[hex(d) for d in devices]}")
    
    if 0x38 in devices:
        import ahtx0
        sensor = ahtx0.AHT20(i2c)
        print("✅ AHT20 Sensor successfully initialized!")
    else:
        print("⚠️  AHT20 Sensor not found on I2C bus (expected address 0x38).")
        print("   If you have it connected, verify your wiring to GPIO 5 (SDA) and GPIO 6 (SCL).")
except Exception as e:
    print(f"⚠️  Could not initialize I2C or Sensor: {e}")

last_post_time = 0
print("\nRunning main loop. Press Ctrl+C to stop.\n")

try:
    while True:
        # 1. Read from AHT20 Sensor (if available)
        if sensor is not None:
            try:
                temp = sensor.temperature
                humidity = sensor.relative_humidity
                print(f"🌡️  Temperature: {temp:.2f} °C | 💧 Humidity: {humidity:.2f} %")
                
                # Post to Home Assistant at intervals (every 60 seconds)
                if time.time() - last_post_time >= 60:
                    import secrets
                    import homeassistant
                    
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
                    last_post_time = time.time()
            except Exception as e:
                print(f"     ⚠️  Error reading AHT20 or posting to HA: {e}")
        
        # Sleep for 5 seconds between readings to reduce CPU usage and sensor wear
        time.sleep(5.0)
except KeyboardInterrupt:
    print("\n[Stop] Main loop interrupted by user. Returning to REPL.")
