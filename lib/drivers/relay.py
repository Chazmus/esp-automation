import machine

class Relay:
    def __init__(self, pin):
        self.pin = machine.Pin(pin, machine.Pin.OUT)
        self.off() # Start off
        
    def on(self):
        self.pin.value(1)
        
    def off(self):
        self.pin.value(0)
        
    def is_on(self):
        return self.pin.value() == 1
