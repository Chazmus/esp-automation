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

        # State tracking
        self.state = IrrigationState.IDLE
        self.state_start_time = time.ticks_ms()
        self.last_cycle_start = time.ticks_ms()

        # Apply configuration
        self.update_config(config)

        # On boot, initialize last_cycle_start to now (cycle will occur after cycle_interval)
        self.last_cycle_start = time.ticks_ms()

        self._ensure_all_off()

    def update_config(self, config):
        """Dynamically update irrigation parameters without rebooting."""
        self.medium = str(config.get("medium", "COCO")).upper()

        # Coco timings
        cycle_hours = config.get("coco_interval_hours", config.get("cycle_hours", 4))
        self.cycle_interval_ms = int(float(cycle_hours) * 60 * 60 * 1000)

        agitate_mins = config.get("coco_agitate_mins", config.get("agitate_mins", 5))
        self.agitate_duration_ms = int(float(agitate_mins) * 60 * 1000)

        irrig_secs = config.get("coco_duration_secs", config.get("irrig_secs", 15))
        self.irrig_duration_ms = int(float(irrig_secs) * 1000)

        drain_wait_mins = config.get(
            "coco_drain_wait_mins", config.get("drain_wait_mins", 10)
        )
        self.drain_wait_ms = int(float(drain_wait_mins) * 60 * 1000)

        drain_secs = config.get("coco_drain_secs", config.get("drain_secs", 60))
        self.drain_duration_ms = int(float(drain_secs) * 1000)

        # Soil moisture parameters
        self.soil_trigger_pct = float(config.get("soil_trigger_pct", 28.0))
        self.soil_target_pct = float(config.get("soil_target_pct", 45.0))

        max_water_secs = config.get("soil_max_water_secs", 60)
        self.soil_max_water_ms = int(float(max_water_secs) * 1000)

        soak_wait_mins = config.get("soil_soak_wait_mins", 60)
        self.soil_soak_wait_ms = int(float(soak_wait_mins) * 60 * 1000)

    def _ensure_all_off(self):
        self.irrig.off()
        self.agitate.off()
        self.waste.off()

    def _transition(self, new_state):
        self.state = new_state
        self.state_start_time = time.ticks_ms()

    def evaluate(self, soil_moisture=None):
        """Evaluates and drives the irrigation state machine based on active medium."""
        current_time = time.ticks_ms()
        elapsed_state = time.ticks_diff(current_time, self.state_start_time)

        if self.medium == "COCO":
            return self._evaluate_coco(current_time, elapsed_state)
        elif self.medium == "SOIL":
            return self._evaluate_soil(current_time, elapsed_state, soil_moisture)
        return None

    def _evaluate_coco(self, current_time, elapsed_state):
        if self.state == IrrigationState.IDLE:
            time_since_cycle = time.ticks_diff(current_time, self.last_cycle_start)
            if time_since_cycle >= self.cycle_interval_ms:
                print("💧 [Coco] Irrigation Cycle Starting: Agitation phase...")
                self.last_cycle_start = current_time
                self.agitate.on()
                self._transition(IrrigationState.AGITATING)
                return "Started Agitation"

        elif self.state == IrrigationState.AGITATING:
            if elapsed_state >= self.agitate_duration_ms:
                print("💧 [Coco] Agitation complete. Starting Irrigation...")
                self.agitate.off()
                self.irrig.on()
                self._transition(IrrigationState.IRRIGATING)
                return "Started Irrigation"

        elif self.state == IrrigationState.IRRIGATING:
            if elapsed_state >= self.irrig_duration_ms:
                print("💧 [Coco] Irrigation complete. Waiting to drain...")
                self.irrig.off()
                self._transition(IrrigationState.WAITING_TO_DRAIN)
                return "Finished Irrigation, Waiting to drain"

        elif self.state == IrrigationState.WAITING_TO_DRAIN:
            if elapsed_state >= self.drain_wait_ms:
                print("💧 [Coco] Drain wait complete. Starting Waste Pump...")
                self.waste.on()
                self._transition(IrrigationState.DRAINING)
                return "Started Draining"

        elif self.state == IrrigationState.DRAINING:
            if elapsed_state >= self.drain_duration_ms:
                print("💧 [Coco] Draining complete. Cycle finished. Returning to IDLE.")
                self.waste.off()
                self._transition(IrrigationState.IDLE)
                return "Cycle Complete"

        return None

    def _evaluate_soil(self, current_time, elapsed_state, soil_moisture):
        if self.state == IrrigationState.IDLE:
            if soil_moisture is not None and soil_moisture <= self.soil_trigger_pct:
                time_since_cycle = time.ticks_diff(current_time, self.last_cycle_start)
                if time_since_cycle >= self.soil_soak_wait_ms:
                    print(
                        f"🌱 [Soil] Moisture low ({soil_moisture}% <= {self.soil_trigger_pct}%). Starting Irrigation..."
                    )
                    self.last_cycle_start = current_time
                    self.irrig.on()
                    self._transition(IrrigationState.IRRIGATING)
                    return f"Started Soil Irrigation (Moisture: {soil_moisture}%)"

        elif self.state == IrrigationState.IRRIGATING:
            target_reached = (
                soil_moisture is not None and soil_moisture >= self.soil_target_pct
            )
            timeout_reached = elapsed_state >= self.soil_max_water_ms

            if target_reached or timeout_reached:
                reason = (
                    f"Target reached ({soil_moisture}%)"
                    if target_reached
                    else "Safety timeout"
                )
                print(f"🌱 [Soil] Irrigation finished: {reason}. Returning to IDLE.")
                self.irrig.off()
                self._transition(IrrigationState.IDLE)
                return f"Finished Soil Irrigation ({reason})"

        return None

    def force_idle(self):
        """Called when switching to Manual mode or stopping cycles immediately."""
        self._ensure_all_off()
        self._transition(IrrigationState.IDLE)

    def schedule_next_cycle(self, delay_seconds: float | int = 0):
        """Schedule the next automated cycle to occur in delay_seconds from now.
        Subsequent cycles will follow the configured interval after this scheduled cycle.
        """
        current_time = time.ticks_ms()
        delay_ms = int(float(delay_seconds) * 1000)
        self.last_cycle_start = current_time - self.cycle_interval_ms + delay_ms
        if delay_seconds <= 0 and self.state == IrrigationState.IDLE:
            self.last_cycle_start = current_time - self.cycle_interval_ms

    def get_next_cycle_in_seconds(self):
        """Returns remaining seconds until the next cycle starts."""
        current_time = time.ticks_ms()
        time_since = time.ticks_diff(current_time, self.last_cycle_start)
        remaining_ms = self.cycle_interval_ms - time_since
        return max(0, int(remaining_ms / 1000))

    def get_state_name(self):
        names = {
            IrrigationState.IDLE: "IDLE",
            IrrigationState.AGITATING: "AGITATING",
            IrrigationState.IRRIGATING: "IRRIGATING",
            IrrigationState.WAITING_TO_DRAIN: "WAITING_TO_DRAIN",
            IrrigationState.DRAINING: "DRAINING",
        }
        return names.get(self.state, "UNKNOWN")
