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



    # Filter state
    filtered_temps = {}
    filtered_humidities = {}

    # Initialize AlertManager
    from lib.alerts import AlertManager
    alert_manager = AlertManager(config)

    # Timer tracking
    last_post_time = 0  # Force an immediate post on the first loop
    last_control_time = time.ticks_ms()

    # Main Loop
    while True:
        sleep_seconds = getattr(config, "SLEEP_SECONDS", 900)
        deep_sleep_enabled = getattr(config, "DEEP_SLEEP_ENABLED", False)
        
        current_time = time.ticks_ms()
        
        # Calculate exact dt for accurate PI math
        dt_ms = time.ticks_diff(current_time, last_control_time)
        dt_seconds = dt_ms / 1000.0 if dt_ms > 0 else 1.0
        last_control_time = current_time

        ha_interval_ms = sleep_seconds * 1000
        should_post = deep_sleep_enabled or (time.ticks_diff(current_time, last_post_time) >= ha_interval_ms)
        
        # --- 1. Read Sensors BEFORE WiFi ---
        readings = {}
        for zone, sensor in temp_sensors.items():
            if should_post:
                print(f"Reading Temperature/Humidity Sensor ({zone})...")
            t, h = sensor.read()
            if t is not None:
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
                
                if should_post:
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
            if should_post:
                print("Reading Soil Moisture Sensor...")
            raw_moisture, moisture_pct = soil_sensor.read()
            if moisture_pct is not None and should_post:
                print(f"🌱 Measured Soil Moisture: {moisture_pct:.1f}% (Raw ADC: {raw_moisture})")

        # Measure battery voltage and percentage
        bat_voltage, bat_percent = None, None
        if getattr(config, "BATTERY_MONITOR_ENABLED", getattr(config, "DEEP_SLEEP_ENABLED", False)):
            bat_voltage = battery.read_voltage()
            bat_percent = battery.get_percentage(bat_voltage)
            if should_post:
                if bat_voltage is not None:
                    print(f"🔋 Battery: {bat_voltage:.2f}V ({bat_percent:.1f}%)")
                else:
                    print("🔋 Battery sensing circuit not detected. Skipping.")



        # --- 3. WiFi Sync and Posting ---
        if should_post:
            last_post_time = current_time
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

        # --- 4. Sleep / Deep Sleep Cycle ---
        if deep_sleep_enabled and not usb.is_usb_connected():
            print(f"💤 Entering Deep Sleep for {sleep_seconds} seconds...")
            time.sleep_ms(100) # Let print buffers clear
            machine.deepsleep(sleep_seconds * 1000)
        else:
            # Short cooperative sleep for the fast control loop
            time.sleep(1)
