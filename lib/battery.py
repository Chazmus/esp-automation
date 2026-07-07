import machine
import time

# Default pin for battery measurement (GPIO3 maps to ADC1_CH3)
# We move to GPIO3 because GPIO2 has a physical 10k pull-up on most ESP32-C3 dev boards
BATTERY_ADC_PIN = 3

def read_voltage():
    """
    Reads the battery voltage from the configured ADC pin.
    Assumes a 1:1 voltage divider (e.g., two identical resistors, like 10k or 100k).
    
    Returns:
        float: The actual battery voltage in volts, or None if the circuit is not detected.
    """
    try:
        # 1. Temporarily enable weak internal pull-down to check if the pin is floating (disconnected)
        pin = machine.Pin(BATTERY_ADC_PIN, machine.Pin.IN, machine.Pin.PULL_DOWN)
        adc = machine.ADC(pin)
        adc.atten(machine.ADC.ATTN_11DB)
        
        # Give the pull-down a tiny moment to pull a floating pin to Ground
        time.sleep_ms(10)
        check_val = adc.read()
        
        # If the reading is extremely low (< 500 raw, which is < 0.3V on the pin),
        # then either no divider is connected (pin pulled to 0V) or the battery is dead.
        if check_val < 500:
            return None
            
        # 2. Since a divider is connected, disable the internal pull-down to prevent
        # its internal resistance (~45k) from throwing off the 1:1 divider ratio (especially with 10k/100k resistors).
        pin = machine.Pin(BATTERY_ADC_PIN, machine.Pin.IN) # Standard input, no pull
        time.sleep_ms(10) # Let voltage settle to its true un-loaded value
        
        # 3. Take multiple readings and average them to filter out ESP32 ADC noise
        total_uv = 0
        num_readings = 5
        for _ in range(num_readings):
            # read_uv() uses factory-calibrated eFuse values to return voltage in microvolts
            total_uv += adc.read_uv()
            time.sleep_ms(10)
        avg_uv = total_uv / num_readings
        
        # Convert microvolts to volts
        pin_voltage = avg_uv / 1_000_000.0
        
        # Multiply by 2 because the external 1:1 voltage divider cuts it in half
        battery_voltage = pin_voltage * 2
        
        return battery_voltage
    except Exception as e:
        print(f"⚠️ Error reading battery: {e}")
        return None

def get_percentage(voltage):
    """
    Calculates approximate battery percentage from voltage (4.2V = 100%, 3.2V = 0%).
    
    Returns:
        float: Battery percentage (0.0 to 100.0) or None if voltage is None.
    """
    if voltage is None:
        return None
    # Li-Ion discharge curve is non-linear, but a linear approximation between 3.2V and 4.2V is standard
    percentage = ((voltage - 3.2) / (4.2 - 3.2)) * 100
    return max(0.0, min(100.0, percentage))
