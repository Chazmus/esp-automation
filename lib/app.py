import machine
import time
import battery
import wifi
import homeassistant
import usb
import network

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
                print(f"🌡️  {zone.capitalize()} Measured: Temp={t:.2f} °C, Humidity={h:.2f} %")
                readings[zone] = (t, h)

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
        bat_voltage = battery.read_voltage()
        bat_percent = battery.get_percentage(bat_voltage)
        if bat_voltage is not None:
            print(f"🔋 Battery: {bat_voltage:.2f}V ({bat_percent:.1f}%)")
        else:
            print("🔋 Battery sensing circuit not detected. Skipping.")

        # --- 2. Actuator Control ---
        if fan is not None and primary_temp is not None:
            cfg = config.PWM_FAN
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
        has_temp_readings = any(t is not None for t, h in readings.values())
        has_data = has_temp_readings or (moisture_pct is not None) or (bat_voltage is not None)
        if has_data:
            print("Connecting to WiFi...")
            if wifi.connect():
                try:
                    for zone, values in readings.items():
                        t, h = values
                        if t is not None:
                            suffix = f"{zone}_temp" if zone != "default" else "temp"
                            friendly = f"{zone.capitalize()} Temperature" if zone != "default" else "Temperature"
                            homeassistant.post_device_sensor(
                                sensor_suffix=suffix,
                                state_value=f"{t:.2f}",
                                friendly_suffix=friendly,
                                unit_of_measurement="°C",
                                device_class="temperature"
                            )
                        if h is not None:
                            suffix = f"{zone}_humidity" if zone != "default" else "humidity"
                            friendly = f"{zone.capitalize()} Humidity" if zone != "default" else "Humidity"
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
