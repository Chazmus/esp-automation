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

# --- LED Configuration ---
LED_PIN_NUMBER = 8  
USE_NEOPIXEL = False  # Set to True if your board has an RGB WS2812 onboard LED

np = None
led = None

if USE_NEOPIXEL:
    import neopixel
    np = neopixel.NeoPixel(machine.Pin(LED_PIN_NUMBER, machine.Pin.OUT), 1)
    print(f"Configured NeoPixel RGB LED on GPIO {LED_PIN_NUMBER}")
else:
    led = machine.Pin(LED_PIN_NUMBER, machine.Pin.OUT)
    print(f"Configured standard digital LED on GPIO {LED_PIN_NUMBER}")

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

counter = 0
print("\nRunning main loop. Press Ctrl+C to stop.\n")

try:
    while True:
        counter += 1
        print(f"[{counter}] Heartbeat: ESP32-C3 is alive!")
        
        # 1. Read from AHT20 Sensor (if available)
        if sensor is not None:
            try:
                temp = sensor.temperature
                humidity = sensor.relative_humidity
                print(f"     🌡️  Temperature: {temp:.2f} °C | 💧 Humidity: {humidity:.2f} %")
            except Exception as e:
                print(f"     ⚠️  Error reading from AHT20: {e}")
        
        # 2. Blink the LED
        if USE_NEOPIXEL and np is not None:
            colors = [(0, 64, 0), (0, 0, 64), (64, 0, 0)]
            color = colors[counter % len(colors)]
            np[0] = color
            np.write()
            time.sleep(0.5)
            np[0] = (0, 0, 0)
            np.write()
            time.sleep(0.5)
        elif led is not None:
            led.value(1)
            time.sleep(0.5)
            led.value(0)
            time.sleep(0.5)
except KeyboardInterrupt:
    print("\n[Stop] Main loop interrupted by user. Returning to REPL.")
