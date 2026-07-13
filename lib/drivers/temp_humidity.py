import machine
import time
import ahtx0

class TempHumiditySensor:
    def __init__(self, sda_pin, scl_pin, sensor_type="AHT20"):
        self.sda_pin = sda_pin
        self.scl_pin = scl_pin
        self.sensor_type = sensor_type.upper()
        self.sensor = None
        self.i2c = None

    def read(self):
        """
        Reads the sensor and returns (temperature, relative_humidity).
        Returns (None, None) if the reading fails.
        """
        if self.sensor is None:
            try:
                # Use I2C channel 0
                self.i2c = machine.I2C(0, sda=machine.Pin(self.sda_pin), scl=machine.Pin(self.scl_pin), freq=100000)
                # Wait for sensor to stabilize
                time.sleep_ms(50)
                
                if self.sensor_type == "AHT10":
                    self.sensor = ahtx0.AHT10(self.i2c)
                else:
                    self.sensor = ahtx0.AHT20(self.i2c)
            except Exception as e:
                print(f"⚠️ Error initializing {self.sensor_type} sensor: {e}")
                self.sensor = None
                return None, None

        try:
            temp = self.sensor.temperature
            humidity = self.sensor.relative_humidity
            return temp, humidity
        except Exception as e:
            print(f"⚠️ Error reading from {self.sensor_type} sensor: {e}")
            # Reset sensor reference to force re-init next time
            self.sensor = None
            return None, None
