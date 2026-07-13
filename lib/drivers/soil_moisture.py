import machine
import time

class SoilMoistureSensor:
    def __init__(self, adc_pin, power_pin=None, dry_value=3800, wet_value=1275, num_samples=5):
        self.adc_pin = adc_pin
        self.power_pin_num = power_pin
        self.dry_value = dry_value
        self.wet_value = wet_value
        self.num_samples = num_samples

    def read(self):
        """
        Reads the soil moisture sensor.
        If a power pin is configured, it powers the sensor on and off.
        Returns a tuple: (raw_average, moisture_percentage)
        """
        power_pin = None
        if self.power_pin_num is not None:
            try:
                power_pin = machine.Pin(self.power_pin_num, machine.Pin.OUT)
                power_pin.value(1)
                # Wait for the sensor to stabilize (capacitive sensors need time)
                time.sleep_ms(100)
            except Exception as e:
                print(f"⚠️ Error powering on soil moisture sensor: {e}")

        try:
            adc = machine.ADC(machine.Pin(self.adc_pin))
            adc.atten(machine.ADC.ATTN_11DB)
            
            readings = []
            for _ in range(self.num_samples):
                readings.append(adc.read())
                if self.num_samples > 1:
                    time.sleep_ms(10)
            
            raw_val = sum(readings) // len(readings)
            
            # Simple linear mapping to percent based on calibrated dry/wet values
            moisture_pct = 100 * (self.dry_value - raw_val) / (self.dry_value - self.wet_value)
            moisture_pct = max(0.0, min(100.0, moisture_pct))
            
            return raw_val, moisture_pct
        except Exception as e:
            print(f"⚠️ Error reading soil moisture sensor on pin {self.adc_pin}: {e}")
            return None, None
        finally:
            if power_pin is not None:
                try:
                    power_pin.value(0)
                    # Float the pin to prevent any leakage current back-feeding the sensor
                    machine.Pin(self.power_pin_num, machine.Pin.IN)
                except Exception as e:
                    print(f"⚠️ Error powering off soil moisture sensor: {e}")
