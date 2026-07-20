import machine
import time
import math
import battery
import wifi
import homeassistant
import usb
import network

def capitalize(s):
    return s[0].upper() + s[1:] if s else ""

def calculate_svp(temp):
    if temp is None:
        return 0.0
    return 0.61078 * math.exp((17.27 * temp) / (temp + 237.3))

def run(config):
    # Print node header
    print("\n========================================")
    print(f"ESP32-C3 Node: {config.DEVICE_NAME}")
    print("========================================\n")
    
    # 1. Reset Cause Check & Safeguard Delay
    # skip safeguard wait if waking up from deep sleep
    deepsleep_reset = getattr(machine, "DEEPSLEEP_RESET", 4)
    if machine.reset_cause() != deepsleep_reset:
        print("Cold boot or hard reset detected.")
        print("Safeguard: Waiting 5 seconds before starting WiFi/Sensor connection...")
        time.sleep(5)
    else:
        print("Woke up from Deep Sleep. Optimizing for fast execution...")

    # Initialize sensors if configured
    temp_sensors = {}
    if getattr(config, "TEMP_HUMIDITY_SENSORS", None):
        from lib.drivers.temp_humidity import TempHumiditySensor
        for zone, cfg in config.TEMP_HUMIDITY_SENSORS.items():
            temp_sensors[zone] = TempHumiditySensor(
                sda_pin=cfg["sda"],
                scl_pin=cfg["scl"],
                sensor_type=cfg.get("type", "AHT20")
            )
    elif getattr(config, "TEMP_HUMIDITY_SENSOR", None):
        from lib.drivers.temp_humidity import TempHumiditySensor
        cfg = config.TEMP_HUMIDITY_SENSOR
        temp_sensors["default"] = TempHumiditySensor(
            sda_pin=cfg["sda"],
            scl_pin=cfg["scl"],
            sensor_type=cfg.get("type", "AHT20")
        )

    soil_sensor = None
    if getattr(config, "SOIL_MOISTURE_SENSOR", None):
        from lib.drivers.soil_moisture import SoilMoistureSensor
        cfg = config.SOIL_MOISTURE_SENSOR
        soil_sensor = SoilMoistureSensor(
            adc_pin=cfg["adc_pin"],
            power_pin=cfg.get("power_pin"),
            dry_value=cfg.get("dry", 3800),
            wet_value=cfg.get("wet", 1275),
            num_samples=cfg.get("num_samples", 5)
        )

    # Initialize actuators if configured
    fan = None
    if getattr(config, "PWM_FAN", None):
        from lib.drivers.fan import PWMFan
        cfg = config.PWM_FAN
        fan = PWMFan(pin=cfg["pin"], freq=cfg.get("freq", 25000))
        
    light_relay = None
    if getattr(config, "LIGHT_RELAY", None):
        from lib.drivers.relay import Relay
        cfg = config.LIGHT_RELAY
        light_relay = Relay(pin=cfg["pin"])

    # Filter state and PI controller state
    filtered_temps = {}
    filtered_humidities = {}
    integral_error = 0.0

    # Initialize AlertManager
    from lib.alerts import AlertManager
    alert_manager = AlertManager(config)

    # Main Loop
    while True:
        sleep_seconds = getattr(config, "SLEEP_SECONDS", 900)
        deep_sleep_enabled = getattr(config, "DEEP_SLEEP_ENABLED", False)
        
        # --- 1. Read Sensors BEFORE WiFi ---
        readings = {}
        for zone, sensor in temp_sensors.items():
            print(f"Reading Temperature/Humidity Sensor ({zone})...")
            t, h = sensor.read()
            if t is not None:
                alpha = 0.2
                if getattr(config, "PWM_FAN", None) and isinstance(config.PWM_FAN, dict):
                    alpha = config.PWM_FAN.get("ema_alpha", 0.2)
                
                if zone in filtered_temps and filtered_temps[zone] is not None:
                    t_filt = alpha * t + (1 - alpha) * filtered_temps[zone]
                else:
                    t_filt = t
                filtered_temps[zone] = t_filt
                
                if zone in filtered_humidities and filtered_humidities[zone] is not None:
                    h_filt = alpha * h + (1 - alpha) * filtered_humidities[zone]
                else:
                    h_filt = h
                filtered_humidities[zone] = h_filt
                
                print(f"🌡️  {capitalize(zone)} Measured (Raw): Temp={t:.2f} °C, Humidity={h:.2f} %")
                print(f"🌡️  {capitalize(zone)} Filtered: Temp={t_filt:.2f} °C, Humidity={h_filt:.2f} %")
                readings[zone] = (t_filt, h_filt)

        primary_temp = None
        if "canopy" in readings:
            primary_temp = readings["canopy"][0]
        elif "default" in readings:
            primary_temp = readings["default"][0]
        elif readings:
            primary_temp = list(readings.values())[0][0]

        raw_moisture, moisture_pct = None, None
        if soil_sensor is not None:
            print("Reading Soil Moisture Sensor...")
            raw_moisture, moisture_pct = soil_sensor.read()
            if moisture_pct is not None:
                print(f"🌱 Measured Soil Moisture: {moisture_pct:.1f}% (Raw ADC: {raw_moisture})")

        # Measure battery voltage and percentage
        bat_voltage, bat_percent = None, None
        if getattr(config, "BATTERY_MONITOR_ENABLED", getattr(config, "DEEP_SLEEP_ENABLED", False)):
            bat_voltage = battery.read_voltage()
            bat_percent = battery.get_percentage(bat_voltage)
            if bat_voltage is not None:
                print(f"🔋 Battery: {bat_voltage:.2f}V ({bat_percent:.1f}%)")
            else:
                print("🔋 Battery sensing circuit not detected. Skipping.")

        # --- 2. Actuator Control ---
        if fan is not None:
            cfg = config.PWM_FAN
            # Check if advanced VPD control is configured and canopy sensor is present
            if "target_vpd" in cfg and "canopy" in readings:
                target_vpd = cfg.get("target_vpd")
                kp = cfg.get("kp", 45.0)
                ki = cfg.get("ki", 0.02)
                min_speed = cfg.get("min_speed", 30)
                max_speed = cfg.get("max_speed", 100)
                
                # Safety override thresholds
                max_safe_temp = cfg.get("max_safe_temp", 30.0)
                min_safe_temp = cfg.get("min_safe_temp", 16.0)
                max_safe_humidity = cfg.get("max_safe_humidity", 65.0)
                
                leaf_offset = cfg.get("leaf_temp_offset", 2.0)
                deadband = cfg.get("deadband", 0.05)
                
                canopy_temp, canopy_humidity = readings["canopy"]
                
                # Safety constraints checks
                if canopy_temp > max_safe_temp:
                    fan.set_speed(100)
                    print(f"💨 OVERRIDE: Canopy Temp ({canopy_temp:.1f}°C) > max safe ({max_safe_temp}°C). Speed set to 100%.")
                elif canopy_humidity > max_safe_humidity:
                    fan.set_speed(100)
                    print(f"💨 OVERRIDE: Canopy Humidity ({canopy_humidity:.1f}%) > max safe ({max_safe_humidity}%). Speed set to 100%.")
                elif canopy_temp < min_safe_temp:
                    fan.set_speed(min_speed)
                    print(f"💨 OVERRIDE: Canopy Temp ({canopy_temp:.1f}°C) < min safe ({min_safe_temp}°C). Speed set to {min_speed}%.")
                else:
                    # Calculate leaf VPD
                    leaf_temp = canopy_temp - leaf_offset
                    svp_leaf = calculate_svp(leaf_temp)
                    svp_air = calculate_svp(canopy_temp)
                    avp_air = svp_air * (canopy_humidity / 100.0)
                    vpd_leaf = max(0.0, svp_leaf - avp_air)
                    
                    error = target_vpd - vpd_leaf
                    
                    # Apply deadband
                    if abs(error) < deadband:
                        error = 0.0
                    
                    # Ambient checks: calculate absolute humidity/moisture
                    ambient_clamp = False
                    avp_ambient = 0.0
                    if "ambient" in readings and error > 0.0:
                        ambient_temp, ambient_humidity = readings["ambient"]
                        svp_ambient = calculate_svp(ambient_temp)
                        avp_ambient = svp_ambient * (ambient_humidity / 100.0)
                        
                        # If ambient air has more or equal absolute water vapor, do not vent to dehumidify
                        if avp_ambient >= avp_air:
                            ambient_clamp = True
                            
                    if ambient_clamp:
                        fan.set_speed(min_speed)
                        print(f"💨 CLAMP: Canopy VPD ({vpd_leaf:.2f} kPa) < Target ({target_vpd:.2f} kPa) [too humid], but ambient room is wetter (AVP ambient {avp_ambient:.2f} >= AVP inside {avp_air:.2f}). Fan speed set to {min_speed}%.")
                    else:
                        # Update integral term with anti-windup clamping
                        # Limit integral error to bounds that are physically realizable.
                        # Since base speed is min_speed, integral_error should not be negative.
                        integral_error += ki * error * sleep_seconds
                        max_i = float(max_speed - min_speed)
                        if integral_error > max_i:
                            integral_error = max_i
                        elif integral_error < 0.0:
                            integral_error = 0.0
                            
                        p_term = kp * error
                        speed = min_speed + p_term + integral_error
                        speed = max(min_speed, min(max_speed, int(speed)))
                        
                        fan.set_speed(speed)
                        print(f"💨 VPD Loop: Leaf VPD = {vpd_leaf:.2f} kPa (Target: {target_vpd:.2f} kPa, Error: {error:.2f}). P={p_term:.1f}, I={integral_error:.1f}. Fan speed set to {speed}%.")
                        
            elif primary_temp is not None:
                # Legacy simple temp-threshold control fallback
                if primary_temp > cfg.get("target_temp", 28.0):
                    fan.set_speed(100)
                    print("💨 Fan speed set to 100% (temperature high)")
                else:
                    fan.set_speed(30)
                    print("💨 Fan speed set to 30% (temperature normal)")
                
        if light_relay is not None:
            # Placeholder: Keep light relay turned on. Customize scheduling logic here.
            light_relay.on()
            print("💡 Light Relay state: ON")

        # --- 3. WiFi Sync and Posting ---
        status_str, severity, active_alerts = alert_manager.evaluate(readings)
        if active_alerts:
            print(f"⚠️ Active Alerts: {status_str} (Severity: {severity})")
        else:
            print("💚 System Status: Normal")

        has_temp_readings = any(t is not None for t, h in readings.values())
        has_data = has_temp_readings or (moisture_pct is not None) or (bat_voltage is not None)
        if has_data:
            print("Connecting to WiFi...")
            if wifi.connect():
                try:
                    # Post system alert status sensor
                    homeassistant.post_device_sensor(
                        sensor_suffix="status",
                        state_value=status_str,
                        friendly_suffix="Status",
                        extra_attributes={
                            "severity": severity,
                            "alert_count": len(active_alerts),
                            "active_alerts": active_alerts
                        }
                    )
                    
                    for zone, values in readings.items():
                        t, h = values
                        if t is not None:
                            suffix = f"{zone}_temp" if zone != "default" else "temp"
                            friendly = f"{capitalize(zone)} Temperature" if zone != "default" else "Temperature"
                            homeassistant.post_device_sensor(
                                sensor_suffix=suffix,
                                state_value=f"{t:.2f}",
                                friendly_suffix=friendly,
                                unit_of_measurement="°C",
                                device_class="temperature"
                            )
                        if h is not None:
                            suffix = f"{zone}_humidity" if zone != "default" else "humidity"
                            friendly = f"{capitalize(zone)} Humidity" if zone != "default" else "Humidity"
                            homeassistant.post_device_sensor(
                                sensor_suffix=suffix,
                                state_value=f"{h:.2f}",
                                friendly_suffix=friendly,
                                unit_of_measurement="%",
                                device_class="humidity"
                            )
                    if moisture_pct is not None:
                        homeassistant.post_device_sensor(
                            sensor_suffix="moisture",
                            state_value=f"{moisture_pct:.1f}",
                            friendly_suffix="Soil Moisture",
                            unit_of_measurement="%",
                            device_class="humidity"
                        )
                    if bat_voltage is not None and bat_percent is not None:
                        homeassistant.post_device_sensor(
                            sensor_suffix="battery",
                            state_value=f"{bat_percent:.1f}",
                            friendly_suffix="Battery Percentage",
                            unit_of_measurement="%",
                            device_class="battery"
                        )
                        homeassistant.post_device_sensor(
                            sensor_suffix="battery_voltage",
                            state_value=f"{bat_voltage:.2f}",
                            friendly_suffix="Battery Voltage",
                            unit_of_measurement="V",
                            device_class="voltage"
                        )
                except Exception as e:
                    print(f"⚠️ Failed to post to Home Assistant: {e}")
                finally:
                    # Cleanly shut down WiFi radio to conserve power only if deep sleep is enabled
                    if deep_sleep_enabled:
                        try:
                            wlan = network.WLAN(network.STA_IF)
                            wlan.active(False)
                            print("📶 WiFi interface shut down.")
                        except Exception as e:
                            print(f"⚠️ Failed to disable WiFi: {e}")
                    else:
                        print("📶 Staying connected (Deep Sleep disabled).")
            else:
                print("❌ WiFi connection failed. Skipping HA post.")
        else:
            print("⚠️ Skipping WiFi connection and HA post due to lack of sensor readings.")

        # --- 3. Sleep / Deep Sleep Cycle ---
        if deep_sleep_enabled and not usb.is_usb_connected():
            print(f"💤 Entering Deep Sleep for {sleep_seconds} seconds...")
            time.sleep_ms(100) # Let print buffers clear
            machine.deepsleep(sleep_seconds * 1000)
        else:
            print(f"🔌 Staying awake. Sleeping {sleep_seconds} seconds before next reading...")
            # Cooperative sleep using small steps so the board responds to interrupts
            for _ in range(int(sleep_seconds * 10)):
                time.sleep_ms(100)
            print("\n🔄 Starting next measurement cycle...")
