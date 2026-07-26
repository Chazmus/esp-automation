import math

def calculate_svp(temp):
    if temp is None:
        return 0.0
    return 0.61078 * math.exp((17.27 * temp) / (temp + 237.3))

class VPDController:
    def __init__(self, fan, config):
        self.fan = fan
        self.target_vpd = config.get("target_vpd", 1.2)
        self.kp = config.get("kp", 45.0)
        self.ki = config.get("ki", 0.02)
        self.min_speed = config.get("min_speed", 30)
        self.max_speed = config.get("max_speed", 100)
        
        self.max_safe_temp = config.get("max_safe_temp", 30.0)
        self.min_safe_temp = config.get("min_safe_temp", 16.0)
        self.max_safe_humidity = config.get("max_safe_humidity", 65.0)
        
        self.leaf_offset = config.get("leaf_temp_offset", 2.0)
        self.deadband = config.get("deadband", 0.05)
        self.target_temp = config.get("target_temp", self.max_safe_temp - 2.0)
        
        self.integral_error = 0.0
        
    def evaluate(self, canopy_temp, canopy_humidity, ambient_temp=None, ambient_humidity=None, dt_seconds=1.0):
        if canopy_temp is None or canopy_humidity is None:
            return
            
        # Safety constraints
        if canopy_temp > self.max_safe_temp:
            self.fan.set_speed(100)
            return f"💨 OVERRIDE: Canopy Temp ({canopy_temp:.1f}°C) > max safe. Fan 100%."
        if canopy_humidity > self.max_safe_humidity:
            self.fan.set_speed(100)
            return f"💨 OVERRIDE: Canopy Hum ({canopy_humidity:.1f}%) > max safe. Fan 100%."
        if canopy_temp < self.min_safe_temp:
            self.fan.set_speed(self.min_speed)
            return f"💨 OVERRIDE: Canopy Temp ({canopy_temp:.1f}°C) < min safe. Fan {self.min_speed}%."
            
        # Leaf VPD calculation
        leaf_temp = canopy_temp - self.leaf_offset
        svp_leaf = calculate_svp(leaf_temp)
        svp_air = calculate_svp(canopy_temp)
        avp_air = svp_air * (canopy_humidity / 100.0)
        vpd_leaf = max(0.0, svp_leaf - avp_air)
        
        error = self.target_vpd - vpd_leaf
        
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
        temp_speed = self.min_speed
        if canopy_temp > self.target_temp:
            temp_range = self.max_safe_temp - self.target_temp
            if temp_range > 0:
                temp_speed = self.min_speed + (self.max_speed - self.min_speed) * ((canopy_temp - self.target_temp) / temp_range)
                
        if ambient_clamp:
            speed = max(self.min_speed, min(self.max_speed, int(temp_speed)))
            self.fan.set_speed(speed)
            if speed > self.min_speed:
                return f"💨 TEMP OVERRIDE (Clamp Active): Fan {speed}%."
            else:
                return f"💨 CLAMP: VPD too humid, but ambient room is wetter. Fan {self.min_speed}%."
        else:
            self.integral_error += self.ki * error * dt_seconds
            max_i = float(self.max_speed - self.min_speed)
            if self.integral_error > max_i:
                self.integral_error = max_i
            elif self.integral_error < 0.0:
                self.integral_error = 0.0
                
            p_term = self.kp * error
            vpd_speed = self.min_speed + p_term + self.integral_error
            
            speed = max(int(vpd_speed), int(temp_speed))
            speed = max(self.min_speed, min(self.max_speed, speed))
            self.fan.set_speed(speed)
            return f"💨 VPD Loop: Leaf VPD={vpd_leaf:.2f} (Target={self.target_vpd:.2f}). Fan {speed}%."
