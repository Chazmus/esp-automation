# main.py -- Soil Moisture Sensor Node
import machine
import time

print("\n========================================")
print("Soil Moisture Monitor starting up...")
print("========================================\n")

# --- Deployment Safeguard ---
print("Starting main loop in 2 seconds... Press Ctrl+C to cancel.")
time.sleep(2)

# --- WiFi Connection ---
import wifi
wifi.connect()

# --- ADC (Analog-to-Digital Converter) Configuration ---
# Physical Wiring:
#   ESP32-C3 3.3V  -->  Soil Moisture Sensor VCC
#   ESP32-C3 GND   -->  Soil Moisture Sensor GND
#   ESP32-C3 GPIO0 -->  Soil Moisture Sensor Analog Out (AO)
# Note: GPIO 0 on the ESP32-C3 supports Analog input (ADC1_CH0).
PIN_NUMBER = 0

adc_pin = None
adc = None

try:
    adc_pin = machine.Pin(PIN_NUMBER)
    adc = machine.ADC(adc_pin)
    # Configure 11dB attenuation to read full 3.3V voltage range (0 - 3.3V)
    adc.atten(machine.ADC.ATTN_11DB)
    print(f"✅ Analog sensor configured on GPIO {PIN_NUMBER} (ADC)")
except Exception as e:
    print(f"⚠️  Could not configure ADC sensor: {e}")

counter = 0
print("\nRunning main loop. Press Ctrl+C to stop.\n")

try:
    while True:
        counter += 1
        
        if adc is not None:
            # Read analog value (0 - 4095 on ESP32-C3 12-bit ADC)
            raw_val = adc.read()
            
            # Convert to estimated moisture percentage (invert if sensor outputs high for dry)
            # Typically, resistive/capacitive soil moisture sensors output:
            #   ~2500 - 3200 (air/dry)
            #   ~1000 - 1500 (fully wet in water)
            # You can calibrate these values for your specific sensor:
            dry_value = 3000
            wet_value = 1200
            
            # Simple linear mapping to percent
            moisture_percent = 100 * (dry_value - raw_val) / (dry_value - wet_value)
            # Clamp percentage between 0 and 100
            moisture_percent = max(0, min(100, moisture_percent))
            
            print(f"[{counter}] Soil Moisture Level: {moisture_percent:.1f}% (Raw ADC: {raw_val})")
        else:
            print(f"[{counter}] Heartbeat: ADC sensor is offline.")
            
        time.sleep(1.0)
except KeyboardInterrupt:
    print("\n[Stop] Main loop interrupted by user. Returning to REPL.")
