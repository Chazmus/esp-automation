def capitalize(s):
    return s[0].upper() + s[1:] if s else ""


class AlertManager:
    def __init__(self, config):
        self.config = config
        self.rules = []

        # Register default MVP safety rules
        self.register_rule(self._check_temp_limits)
        self.register_rule(self._check_humidity_limits)

    def register_rule(self, rule_func):
        """
        Registers a new checker rule function.
        rule_func should accept 'readings' and return a tuple: (alerts_list, severity_str)
        """
        self.rules.append(rule_func)

    def evaluate(self, readings):
        """
        Evaluates all registered rules against the current readings.
        Returns a tuple: (status_str, severity, active_alerts_list)
        """
        active_alerts = []
        highest_severity = "normal"

        for rule in self.rules:
            try:
                alerts, severity = rule(readings)
                if alerts:
                    active_alerts.extend(alerts)
                    if severity == "critical" or (
                        severity == "warning" and highest_severity == "normal"
                    ):
                        highest_severity = severity
            except Exception as e:
                print(f"⚠️ Error evaluating alert rule: {e}")

        status_str = ", ".join(active_alerts) if active_alerts else "Normal"
        return status_str, highest_severity, active_alerts

    def _check_temp_limits(self, readings):
        cfg = getattr(self.config, "ALERTS", {})
        fan_cfg = getattr(self.config, "PWM_FAN", {})
        temp_high = cfg.get("temp_high", fan_cfg.get("max_safe_temp", 30.0))
        temp_low = cfg.get("temp_low", fan_cfg.get("min_safe_temp", 16.0))

        alerts = []
        severity = "normal"
        sensor_readings = [
            k for k, v in readings.items() if isinstance(v, (tuple, list))
        ]
        multi = len(sensor_readings) > 1

        for zone, values in readings.items():
            if isinstance(values, (tuple, list)) and len(values) >= 1:
                t = values[0]
                if t is not None:
                    prefix = (
                        f"{capitalize(zone)} "
                        if multi and zone not in ("default",)
                        else ""
                    )
                    if t > temp_high:
                        alerts.append(f"{prefix}High Temp ({t:.1f}°C)")
                        severity = "critical"
                    elif t < temp_low:
                        alerts.append(f"{prefix}Low Temp ({t:.1f}°C)")
                        severity = "critical"
        return alerts, severity

    def _check_humidity_limits(self, readings):
        cfg = getattr(self.config, "ALERTS", {})
        fan_cfg = getattr(self.config, "PWM_FAN", {})
        hum_high = cfg.get("humidity_high", fan_cfg.get("max_safe_humidity", 65.0))
        hum_low = cfg.get("humidity_low", 30.0)

        alerts = []
        severity = "normal"
        sensor_readings = [
            k for k, v in readings.items() if isinstance(v, (tuple, list))
        ]
        multi = len(sensor_readings) > 1

        for zone, values in readings.items():
            if isinstance(values, (tuple, list)) and len(values) >= 2:
                h = values[1]
                if h is not None:
                    prefix = (
                        f"{capitalize(zone)} "
                        if multi and zone not in ("default",)
                        else ""
                    )
                    if h > hum_high:
                        alerts.append(f"{prefix}High Humidity ({h:.1f}%)")
                        severity = "critical"
                    elif h < hum_low:
                        alerts.append(f"{prefix}Low Humidity ({h:.1f}%)")
                        severity = "critical"
        return alerts, severity
