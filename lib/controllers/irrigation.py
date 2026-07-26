import time

class IrrigationState:
    IDLE = 0
    AGITATING = 1
    IRRIGATING = 2
    WAITING_TO_DRAIN = 3
    DRAINING = 4

class IrrigationController:
    def __init__(self, irrig_relay, agitate_relay, waste_relay, config):
        self.irrig = irrig_relay
        self.agitate = agitate_relay
        self.waste = waste_relay
        
        # Timing Configuration
        # Defaults match the README
        self.cycle_interval_ms = config.get("cycle_hours", 4) * 60 * 60 * 1000
        self.agitate_duration_ms = config.get("agitate_mins", 5) * 60 * 1000
        self.irrig_duration_ms = config.get("irrig_secs", 15) * 1000
        self.drain_wait_ms = config.get("drain_wait_mins", 10) * 60 * 1000
        self.drain_duration_ms = config.get("drain_secs", 60) * 1000
        
        # State tracking
        self.state = IrrigationState.IDLE
        self.state_start_time = time.ticks_ms()
        self.last_cycle_start = time.ticks_ms() - self.cycle_interval_ms + (5 * 60 * 1000) # Start soon on boot
        
        self._ensure_all_off()
        
    def _ensure_all_off(self):
        self.irrig.off()
        self.agitate.off()
        self.waste.off()
        
    def _transition(self, new_state):
        self.state = new_state
        self.state_start_time = time.ticks_ms()
        
    def evaluate(self):
        current_time = time.ticks_ms()
        elapsed_state = time.ticks_diff(current_time, self.state_start_time)
        
        if self.state == IrrigationState.IDLE:
            time_since_cycle = time.ticks_diff(current_time, self.last_cycle_start)
            if time_since_cycle >= self.cycle_interval_ms:
                print("💧 Irrigation Cycle Starting: Agitation phase...")
                self.last_cycle_start = current_time
                self.agitate.on()
                self._transition(IrrigationState.AGITATING)
                return "Started Agitation"
                
        elif self.state == IrrigationState.AGITATING:
            if elapsed_state >= self.agitate_duration_ms:
                print("💧 Agitation complete. Starting Irrigation...")
                self.agitate.off()
                self.irrig.on()
                self._transition(IrrigationState.IRRIGATING)
                return "Started Irrigation"
                
        elif self.state == IrrigationState.IRRIGATING:
            if elapsed_state >= self.irrig_duration_ms:
                print("💧 Irrigation complete. Waiting to drain...")
                self.irrig.off()
                self._transition(IrrigationState.WAITING_TO_DRAIN)
                return "Finished Irrigation, Waiting to drain"
                
        elif self.state == IrrigationState.WAITING_TO_DRAIN:
            if elapsed_state >= self.drain_wait_ms:
                print("💧 Drain wait complete. Starting Waste Pump...")
                self.waste.on()
                self._transition(IrrigationState.DRAINING)
                return "Started Draining"
                
        elif self.state == IrrigationState.DRAINING:
            if elapsed_state >= self.drain_duration_ms:
                print("💧 Draining complete. Cycle finished. Returning to IDLE.")
                self.waste.off()
                self._transition(IrrigationState.IDLE)
                return "Cycle Complete"
                
        return None
        
    def force_idle(self):
        """Called when switching from Auto back to Manual to ensure pumps stop."""
        self._ensure_all_off()
        self._transition(IrrigationState.IDLE)
