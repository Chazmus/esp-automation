import time
import machine
import wifi
import config
import secrets
import json
from umqtt.simple import MQTTClient

from lib.drivers.relay import Relay
from lib.drivers.fan import PWMFan
from lib.drivers.temp_humidity import TempHumiditySensor
from lib.controllers.vpd import VPDController, calculate_vpd
from lib.controllers.irrigation import IrrigationController
from lib.config_store import ConfigStore


print("\n========================================")
print(f"ESP32-C3 Node: {config.DEVICE_NAME} (MQTT HOA Edition)")
print("========================================\n")

# --- 1. State Tracking & Config Store ---
vent_mode = "AUTO"
irrig_mode = "AUTO"
config_store = ConfigStore()

# --- 2. Hardware Initialization ---
fan = PWMFan(pin=config.PWM_FAN["pin"], freq=config.PWM_FAN.get("freq", 25000))

# Relays (Active-High configuration for COM-High jumper setting)
drip_relay = Relay(pin=config.IRRIGATION_CONFIG["drip_pin"], active_high=True)
agitate_relay = Relay(pin=config.IRRIGATION_CONFIG["agitate_pin"], active_high=True)
waste_relay = Relay(pin=config.IRRIGATION_CONFIG["waste_pin"], active_high=True)

# Controllers
vpd_controller = VPDController(fan, config.PWM_FAN)
vpd_controller.set_mode(vent_mode)

irrig_settings = dict(config.IRRIGATION_CONFIG)
irrig_settings.update(config_store.config)
irrig_controller = IrrigationController(drip_relay, agitate_relay, waste_relay, irrig_settings)

# Sensors
temp_sensors = {}
if hasattr(config, "TEMP_HUMIDITY_SENSORS"):
    for zone, cfg in config.TEMP_HUMIDITY_SENSORS.items():
        temp_sensors[zone] = TempHumiditySensor(sda_pin=cfg["sda"], scl_pin=cfg["scl"], sensor_type=cfg.get("type", "AHT20"))
        
soil_sensor = None
if hasattr(config, "SOIL_MOISTURE_SENSOR"):
    from lib.drivers.soil_moisture import SoilMoistureSensor
    cfg = config.SOIL_MOISTURE_SENSOR
    soil_sensor = SoilMoistureSensor(adc_pin=cfg["adc_pin"], power_pin=cfg.get("power_pin"), dry_value=cfg.get("dry", 3800), wet_value=cfg.get("wet", 1275), num_samples=cfg.get("num_samples", 5))

# --- 3. MQTT Configuration ---
MQTT_BROKER = getattr(secrets, 'MQTT_BROKER', secrets.HA_URL.replace("http://", "").split(":")[0])
MQTT_USER = getattr(secrets, 'MQTT_USER', 'mqtt_user')
MQTT_PASSWORD = getattr(secrets, 'MQTT_PASSWORD', '')
CLIENT_ID = f"esp32_{config.DEVICE_NAME}"
BASE_TOPIC = config.MQTT_BASE_TOPIC

def pub(client, topic, payload, retain=False):
    client.publish(f"{BASE_TOPIC}/{topic}".encode(), str(payload).encode(), retain=retain)

def mqtt_callback(topic, msg):
    global vent_mode, irrig_mode
    topic = topic.decode()
    msg = msg.decode()
    print(f"MQTT Rx: {topic} -> {msg}")
    
    # -- Ventilation Controls --
    if topic.endswith("ventilation/mode/set"):
        raw_mode = msg.upper()
        if raw_mode in ("AUTO", "GROW"):
            vent_mode = "AUTO"
        elif raw_mode == "MANUAL":
            vent_mode = "MANUAL"

        vpd_controller.set_mode(vent_mode)
        pub(client, "ventilation/mode/state", vent_mode, retain=True)
        if vent_mode == "MANUAL":
            pub(client, "ventilation/reason/state", f"Manual Override: Fan set to {int(fan.speed)}%", retain=True)
        else:
            pub(client, "ventilation/reason/state", "Auto Mode: Evaluating VPD closed-loop", retain=True)
        print(f"Switched Ventilation mode to {vent_mode}")
            
    elif topic.endswith("ventilation/fan/set"):
        if vent_mode == "MANUAL":
            fan.set_speed(int(msg))
            pub(client, "ventilation/fan/state", int(fan.speed))
            pub(client, "ventilation/reason/state", f"Manual Override: Fan set to {int(fan.speed)}%", retain=True)
            
    # -- Irrigation Controls --
    elif topic.endswith("irrigation/mode/set"):
        raw_mode = msg.upper()
        if raw_mode == "AUTO":
            irrig_mode = "AUTO"
        elif raw_mode == "MANUAL":
            irrig_mode = "MANUAL"
            irrig_controller.force_idle()
            print("Switched Irrigation to MANUAL. All pumps stopped.")
            pub(client, "irrigation/drip/state", "OFF")
            pub(client, "irrigation/agitate/state", "OFF")
            pub(client, "irrigation/waste/state", "OFF")

        pub(client, "irrigation/mode/state", irrig_mode, retain=True)
            
    elif topic.endswith("irrigation/drip/set") and irrig_mode == "MANUAL":
        drip_relay.on() if msg == "ON" else drip_relay.off()
        pub(client, "irrigation/drip/state", "ON" if drip_relay.is_on() else "OFF")
        
    elif topic.endswith("irrigation/agitate/set") and irrig_mode == "MANUAL":
        agitate_relay.on() if msg == "ON" else agitate_relay.off()
        pub(client, "irrigation/agitate/state", "ON" if agitate_relay.is_on() else "OFF")
        
    elif topic.endswith("irrigation/waste/set") and irrig_mode == "MANUAL":
        waste_relay.on() if msg == "ON" else waste_relay.off()
        pub(client, "irrigation/waste/state", "ON" if waste_relay.is_on() else "OFF")

    elif topic.endswith("irrigation/next_cycle/set"):
        try:
            delay_secs = None
            if msg.startswith("{"):
                data = json.loads(msg)
                delay_secs = data.get("delay_seconds")
            else:
                delay_secs = float(msg)

            if delay_secs is not None:
                irrig_controller.schedule_next_cycle(delay_seconds=float(delay_secs))
                if irrig_mode == "MANUAL":
                    irrig_mode = "AUTO"
                    pub(client, "irrigation/mode/state", "AUTO", retain=True)
                    print("Switched Irrigation to AUTO for scheduled cycle.")

                rem = irrig_controller.get_next_cycle_in_seconds()
                pub(client, "irrigation/next_cycle/state", str(rem), retain=True)
                print(f"💧 Scheduled next cycle in {delay_secs}s (remaining: {rem}s)")
        except Exception as e:
            print(f"⚠️ Error scheduling next cycle: {e}")

    # -- Dynamic Grow Configuration --
    elif "/config/" in topic and topic.endswith("/set"):
        parts = topic.split("/")
        if len(parts) >= 4:
            param = parts[-2]
            key_map = {
                "medium": ("medium", str),
                "coco_interval": ("coco_interval_hours", float),
                "coco_interval_hours": ("coco_interval_hours", float),
                "coco_duration": ("coco_duration_secs", float),
                "coco_duration_secs": ("coco_duration_secs", float),
                "soil_trigger": ("soil_trigger_pct", float),
                "soil_trigger_pct": ("soil_trigger_pct", float),
                "soil_target": ("soil_target_pct", float),
                "soil_target_pct": ("soil_target_pct", float),
                "soil_max_water": ("soil_max_water_secs", float),
                "soil_max_water_secs": ("soil_max_water_secs", float),
                "soil_soak_wait": ("soil_soak_wait_mins", float),
                "soil_soak_wait_mins": ("soil_soak_wait_mins", float),
                "light_preset": ("light_preset", str),
            }
            if param in key_map:
                store_key, conv = key_map[param]
                try:
                    val = conv(msg)
                    config_store.set(store_key, val)
                    irrig_controller.update_config(config_store.config)
                    pub(client, f"config/{param}/state", str(val), retain=True)
                    if store_key != param:
                        pub(client, f"config/{store_key}/state", str(val), retain=True)
                    print(f"⚙️ Config applied & saved: {store_key} = {val}")
                except Exception as e:
                    print(f"⚠️ Error applying config {param}={msg}: {e}")



# --- 4. Network Setup ---
print("Connecting to WiFi...")
if wifi.connect():
    print(f"Connecting to MQTT Broker at {MQTT_BROKER}...")
    client = MQTTClient(CLIENT_ID, MQTT_BROKER, user=MQTT_USER, password=MQTT_PASSWORD, keepalive=60)
    client.set_callback(mqtt_callback)
    
    try:
        # Set Last Will and Testament for automatic offline detection
        client.set_last_will(f"{BASE_TOPIC}/status".encode(), b"offline", retain=True)
        client.connect()
        # Publish online status
        pub(client, "status", "online", retain=True)
        # Subscribe to all command topics
        client.subscribe(f"{BASE_TOPIC}/config/+/set".encode())
        client.subscribe(f"{BASE_TOPIC}/+/+/set".encode())
        client.subscribe(f"{BASE_TOPIC}/+/set".encode())
        print("✅ MQTT Connected & Subscribed to all /set topics.")
        
        # Publish initial states
        pub(client, "ventilation/mode/state", vent_mode, retain=True)
        pub(client, "irrigation/mode/state", irrig_mode, retain=True)
        for k, v in config_store.config.items():
            pub(client, f"config/{k}/state", str(v), retain=True)
        
        last_sensor_read = 0
        last_ha_post = 0
        latest_soil_pct = None
        
        # --- 5. Main Loop ---
        while True:
            # 1. Process inbound MQTT commands
            client.check_msg()
            
            current_time = time.ticks_ms()
            
            # 2. Sensor reading & VPD (Every 5 seconds)
            if time.ticks_diff(current_time, last_sensor_read) > 5000:
                last_sensor_read = current_time
                readings = {}
                for zone, sensor in temp_sensors.items():
                    t, h = sensor.read()
                    readings[zone] = (t, h)
                    
                canopy_t, canopy_h = readings.get("canopy", (None, None))
                ambient_t, ambient_h = readings.get("ambient", (None, None))
                
                if vent_mode == "AUTO":
                    log = vpd_controller.evaluate(canopy_t, canopy_h, ambient_t, ambient_h, dt_seconds=5.0)
                    if log:
                        print(log)
                        pub(client, "ventilation/reason/state", log, retain=True)
                    pub(client, "ventilation/fan/state", int(fan.speed))
                    
                # Post telemetry every 10 seconds via MQTT
                if time.ticks_diff(current_time, last_ha_post) > 10000:
                    last_ha_post = current_time
                    telemetry = {}
                    for zone, (t, h) in readings.items():
                        if t is not None:
                            telemetry[f"{zone}_temp"] = round(t, 2)
                        if h is not None:
                            telemetry[f"{zone}_humidity"] = round(h, 2)
                        if t is not None and h is not None:
                            offset = vpd_controller.leaf_offset if zone in ("canopy", "pot") else 0.0
                            vpd_val = calculate_vpd(t, h, leaf_offset=offset)
                            if vpd_val is not None:
                                telemetry[f"{zone}_vpd"] = round(vpd_val, 2)
                                
                    if soil_sensor is not None:
                        raw, pct = soil_sensor.read()
                        if pct is not None:
                            latest_soil_pct = pct
                            telemetry["moisture"] = round(pct, 1)

                    if fan is not None:
                        telemetry["fan_speed"] = int(fan.speed)

                    if hasattr(vpd_controller, 'last_vpd') and vpd_controller.last_vpd is not None:
                        telemetry["vpd"] = round(vpd_controller.last_vpd, 2)

                    if hasattr(vpd_controller, 'last_reason') and vpd_controller.last_reason:
                        telemetry["fan_reason"] = vpd_controller.last_reason

                    if irrig_controller is not None:
                        next_sec = irrig_controller.get_next_cycle_in_seconds()
                        telemetry["next_feed_seconds"] = next_sec
                        telemetry["irrigation_state"] = irrig_controller.state
                        pub(client, "irrigation/next_cycle/state", str(next_sec), retain=True)

                    if telemetry:
                        payload_json = json.dumps(telemetry)
                        print(f"📡 MQTT Telemetry: {payload_json}")
                        pub(client, "telemetry", payload_json)
            
            # 3. Irrigation State Machine
            if irrig_mode == "AUTO":
                log = irrig_controller.evaluate(soil_moisture=latest_soil_pct)
                if log:
                    print(log)
                    pub(client, "irrigation/drip/state", "ON" if drip_relay.is_on() else "OFF")
                    pub(client, "irrigation/agitate/state", "ON" if agitate_relay.is_on() else "OFF")
                    pub(client, "irrigation/waste/state", "ON" if waste_relay.is_on() else "OFF")
                    
            time.sleep(0.1) # Yield to RTOS
            
    except KeyboardInterrupt:
        print("\nExiting. Ensuring safe state...")
        irrig_controller.force_idle()
        try:
            pub(client, "status", "offline", retain=True)
            client.disconnect()
        except Exception:
            pass
    except Exception as e:
        print(f"❌ Crash: {e}")
        irrig_controller.force_idle()
        try:
            pub(client, "status", "offline", retain=True)
            client.disconnect()
        except Exception:
            pass
else:
    print("❌ WiFi failed.")
