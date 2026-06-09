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

# Configuration: Adjust the pin numbers based on your specific board.
LED_PIN_NUMBER = 8  

# Detect if we should use NeoPixel or a standard simple LED.
USE_NEOPIXEL = False  # Set to True if your board has an RGB WS2812 onboard LED

# Initialize variables to None to satisfy static analysis (LSPs like Pyright)
np = None
led = None

if USE_NEOPIXEL:
    import neopixel
    # Initialize NeoPixel on the configured pin with 1 pixel
    np = neopixel.NeoPixel(machine.Pin(LED_PIN_NUMBER, machine.Pin.OUT), 1)
    print(f"Configured NeoPixel RGB LED on GPIO {LED_PIN_NUMBER}")
else:
    # Initialize standard LED on configured pin
    led = machine.Pin(LED_PIN_NUMBER, machine.Pin.OUT)
    print(f"Configured standard digital LED on GPIO {LED_PIN_NUMBER}")

counter = 0
print("Running main loop. Press Ctrl+C to stop.")

try:
    while True:
        counter += 1
        print(f"[{counter}] Heartbeat: ESP32-C3 is alive and running Python!")
        
        if USE_NEOPIXEL and np is not None:
            # Blink NeoPixel with different colors: Green, Blue, Red
            colors = [(0, 64, 0), (0, 0, 64), (64, 0, 0)]
            color = colors[counter % len(colors)]
            np[0] = color
            np.write()
            time.sleep(0.5)
            np[0] = (0, 0, 0) # Turn off
            np.write()
            time.sleep(0.5)
        elif led is not None:
            # Blink standard digital LED
            led.value(1) # Turn on
            time.sleep(0.5)
            led.value(0) # Turn off
            time.sleep(0.5)
except KeyboardInterrupt:
    print("\n[Stop] Main loop interrupted by user. Returning to REPL.")
