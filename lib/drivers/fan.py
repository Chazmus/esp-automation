import machine

class PWMFan:
    def __init__(self, pin, freq=25000):
        self.pin = machine.Pin(pin)
        self.pwm = machine.PWM(self.pin, freq=freq)
        self.set_speed(0)
        
    def set_speed(self, percentage):
        """Sets the fan speed (0-100%)."""
        percentage = max(0.0, min(100.0, percentage))
        # MicroPython PWM duty is 0-1023 (10-bit resolution)
        duty = int((percentage / 100.0) * 1023)
        self.pwm.duty(duty)
        
    def deinit(self):
        self.pwm.deinit()
