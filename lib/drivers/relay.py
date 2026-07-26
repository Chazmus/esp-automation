import machine

class Relay:
    def __init__(self, pin, active_high=True):
        self.pin = machine.Pin(pin, machine.Pin.OUT)
        self.active_high = active_high
        self.off() # Start off
        
    def on(self):
        self.pin.value(1 if self.active_high else 0)
        
    def off(self):
        self.pin.value(0 if self.active_high else 1)
        
    def is_on(self):
        return self.pin.value() == (1 if self.active_high else 0)
