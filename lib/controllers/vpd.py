import math

def calculate_svp(temp):
    if temp is None:
        return 0.0
    return 0.61078 * math.exp((17.27 * temp) / (temp + 237.3))

def calculate_vpd(temp, humidity, leaf_offset=0.0):
    if temp is None or humidity is None:
        return None
    leaf_temp = temp - leaf_offset
    svp_leaf = calculate_svp(leaf_temp)
    svp_air = calculate_svp(temp)
    avp_air = svp_air * (humidity / 100.0)
    return max(0.0, svp_leaf - avp_air)


class VPDController:
    def __init__(self, fan, config):
        self.fan = fan
        self.mode = "GROW"
        
        # Grow mode parameters
        self.grow_target_vpd = config.get("target_vpd", 1.2)
        self.grow_leaf_offset = config.get("leaf_temp_offset", 2.0)
        self.grow_min_speed = config.get("min_speed", 30)
        
        # Dry mode parameters
        self.dry_target_vpd = config.get("dry_target_vpd", 0.9)
        self.dry_leaf_offset = config.get("dry_leaf_temp_offset", 0.0)
        self.dry_min_speed = config.get("dry_min_speed", 20)
        self.dry_max_safe_humidity = config.get("dry_max_safe_humidity", 65.0)
        
        self.kp = config.get("kp", 45.0)
        self.ki = config.get("ki", 0.02)
        self.max_speed = config.get("max_speed", 100)
        
        self.max_safe_temp = config.get("max_safe_temp", 30.0)
        self.min_safe_temp = config.get("min_safe_temp", 16.0)
        self.max_safe_humidity = config.get("max_safe_humidity", 65.0)
        
        self.deadband = config.get("deadband", 0.05)
        self.target_temp = config.get("target_temp", self.max_safe_temp - 2.0)
        
        self.integral_error = 0.0
        self.last_vpd = 0.0

    @property
    def target_vpd(self):
        return self.dry_target_vpd if self.mode == "DRY" else self.grow_target_vpd

    @target_vpd.setter
    def target_vpd(self, val):
        if self.mode == "DRY":
            self.dry_target_vpd = val
        else:
            self.grow_target_vpd = val

    @property
    def leaf_offset(self):
        return self.dry_leaf_offset if self.mode == "DRY" else self.grow_leaf_offset

    @leaf_offset.setter
    def leaf_offset(self, val):
        if self.mode == "DRY":
            self.dry_leaf_offset = val
        else:
            self.grow_leaf_offset = val

    @property
    def min_speed(self):
        return self.dry_min_speed if self.mode == "DRY" else self.grow_min_speed

    @min_speed.setter
    def min_speed(self, val):
        if self.mode == "DRY":
            self.dry_min_speed = val
        else:
            self.grow_min_speed = val

    @property
    def active_max_safe_humidity(self):
        return self.dry_max_safe_humidity if self.mode == "DRY" else self.max_safe_humidity

    def set_mode(self, mode):
        m = str(mode).upper()
        if m in ("AUTO", "GROW"):
            self.mode = "GROW"
        elif m == "DRY":
            self.mode = "DRY"
        elif m == "MANUAL":
            self.mode = "MANUAL"
        self.integral_error = 0.0
        
    def evaluate(self, canopy_temp, canopy_humidity, ambient_temp=None, ambient_humidity=None, dt_seconds=1.0):
        if canopy_temp is None or canopy_humidity is None:
            return
            
        cur_min_speed = self.min_speed
        cur_max_safe_hum = self.active_max_safe_humidity
        cur_target_vpd = self.target_vpd
        cur_leaf_offset = self.leaf_offset

        # Safety constraints
        if canopy_temp > self.max_safe_temp:
            self.fan.set_speed(100)
            return f"💨 OVERRIDE: Canopy Temp ({canopy_temp:.1f}°C) > max safe. Fan 100%."
        if canopy_humidity > cur_max_safe_hum:
            self.fan.set_speed(100)
            return f"💨 OVERRIDE ({self.mode}): Canopy Hum ({canopy_humidity:.1f}%) > max safe ({cur_max_safe_hum:.1f}%). Fan 100%."
        if canopy_temp < self.min_safe_temp:
            self.fan.set_speed(cur_min_speed)
            return f"💨 OVERRIDE: Canopy Temp ({canopy_temp:.1f}°C) < min safe. Fan {cur_min_speed}%."
            
        # Leaf VPD calculation
        leaf_temp = canopy_temp - cur_leaf_offset
        svp_leaf = calculate_svp(leaf_temp)
        svp_air = calculate_svp(canopy_temp)
        avp_air = svp_air * (canopy_humidity / 100.0)
        vpd_leaf = max(0.0, svp_leaf - avp_air)
        self.last_vpd = vpd_leaf
        
        error = cur_target_vpd - vpd_leaf
        
        if abs(error) < self.deadband:
            error = 0.0
            
        ambient_clamp = False
        avp_ambient = 0.0
        if ambient_temp is not None and ambient_humidity is not None and error > 0.0:
            svp_ambient = calculate_svp(ambient_temp)
            avp_ambient = svp_ambient * (ambient_humidity / 100.0)
            if avp_ambient >= avp_air:
                ambient_clamp = True
                
        # Proportional temp speed
        temp_speed = cur_min_speed
        if canopy_temp > self.target_temp:
            temp_range = self.max_safe_temp - self.target_temp
            if temp_range > 0:
                temp_speed = cur_min_speed + (self.max_speed - cur_min_speed) * ((canopy_temp - self.target_temp) / temp_range)
                
        if ambient_clamp:
            speed = max(cur_min_speed, min(self.max_speed, int(temp_speed)))
            self.fan.set_speed(speed)
            if speed > cur_min_speed:
                return f"💨 TEMP OVERRIDE (Clamp Active): Fan {speed}%."
            else:
                return f"💨 CLAMP: VPD too humid, but ambient room is wetter. Fan {cur_min_speed}%."
        else:
            self.integral_error += self.ki * error * dt_seconds
            max_i = float(self.max_speed - cur_min_speed)
            if self.integral_error > max_i:
                self.integral_error = max_i
            elif self.integral_error < 0.0:
                self.integral_error = 0.0
                
            p_term = self.kp * error
            vpd_speed = cur_min_speed + p_term + self.integral_error
            
            speed = max(int(vpd_speed), int(temp_speed))
            speed = max(cur_min_speed, min(self.max_speed, speed))
            self.fan.set_speed(speed)
            return f"💨 VPD Loop ({self.mode}): Leaf VPD={vpd_leaf:.2f} (Target={cur_target_vpd:.2f}). Fan {speed}%."

