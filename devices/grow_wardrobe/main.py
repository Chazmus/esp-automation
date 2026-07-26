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
from lib.controllers.vpd import VPDController
from lib.controllers.irrigation import IrrigationController

print("\n========================================")
print(f"ESP32-C3 Node: {config.DEVICE_NAME} (MQTT HOA Edition)")
print("========================================\n")

# --- 1. State Tracking ---
vent_mode = "AUTO"
irrig_mode = "AUTO"

# --- 2. Hardware Initialization ---
fan = PWMFan(pin=config.PWM_FAN["pin"], freq=config.PWM_FAN.get("freq", 25000))

# Relays (Active-Low configuration)
drip_relay = Relay(pin=config.IRRIGATION_CONFIG["drip_pin"], active_high=False)
agitate_relay = Relay(pin=config.IRRIGATION_CONFIG["agitate_pin"], active_high=False)
waste_relay = Relay(pin=config.IRRIGATION_CONFIG["waste_pin"], active_high=False)
light_relay = Relay(pin=config.LIGHT_RELAY["pin"], active_high=False)

# Controllers
vpd_controller = VPDController(fan, config.PWM_FAN)
irrig_controller = IrrigationController(drip_relay, agitate_relay, waste_relay, config.IRRIGATION_CONFIG)

# Sensors
temp_sensors = {}
if hasattr(config, "TEMP_HUMIDITY_SENSORS"):
    for zone, cfg in config.TEMP_HUMIDITY_SENSORS.items():
        temp_sensors[zone] = TempHumiditySensor(sda_pin=cfg["sda"], scl_pin=cfg["scl"], sensor_type=cfg.get("type", "AHT20"))

# --- 3. MQTT Configuration ---
MQTT_BROKER = getattr(secrets, 'MQTT_BROKER', secrets.HA_URL.replace("http://", "").split(":")[0])
MQTT_USER = getattr(secrets, 'MQTT_USER', 'mqtt_user')
MQTT_PASSWORD = getattr(secrets, 'MQTT_PASSWORD', '')
CLIENT_ID = f"esp32_{config.DEVICE_NAME}"
BASE_TOPIC = config.MQTT_BASE_TOPIC

def pub(client, topic, payload):
    client.publish(f"{BASE_TOPIC}/{topic}".encode(), str(payload).encode())

def mqtt_callback(topic, msg):
    global vent_mode, irrig_mode
    topic = topic.decode()
    msg = msg.decode()
    print(f"MQTT Rx: {topic} -> {msg}")
    
    # -- Ventilation Controls --
    if topic.endswith("ventilation/mode/set"):
        vent_mode = msg
        pub(client, "ventilation/mode/state", vent_mode)
        if vent_mode == "MANUAL":
            print("Switched Ventilation to MANUAL. Waiting for fan speed commands.")
            
    elif topic.endswith("ventilation/fan/set"):
        if vent_mode == "MANUAL":
            fan.set_speed(int(msg))
            pub(client, "ventilation/fan/state", int(fan.speed))
            
    # -- Irrigation Controls --
    elif topic.endswith("irrigation/mode/set"):
        irrig_mode = msg
        pub(client, "irrigation/mode/state", irrig_mode)
        if irrig_mode == "MANUAL":
            irrig_controller.force_idle()
            print("Switched Irrigation to MANUAL. All pumps stopped.")
            pub(client, "irrigation/drip/state", "OFF")
            pub(client, "irrigation/agitate/state", "OFF")
            pub(client, "irrigation/waste/state", "OFF")
            
    elif topic.endswith("irrigation/drip/set") and irrig_mode == "MANUAL":
        drip_relay.on() if msg == "ON" else drip_relay.off()
        pub(client, "irrigation/drip/state", "ON" if drip_relay.is_on() else "OFF")
        
    elif topic.endswith("irrigation/agitate/set") and irrig_mode == "MANUAL":
        agitate_relay.on() if msg == "ON" else agitate_relay.off()
        pub(client, "irrigation/agitate/state", "ON" if agitate_relay.is_on() else "OFF")
        
    elif topic.endswith("irrigation/waste/set") and irrig_mode == "MANUAL":
        waste_relay.on() if msg == "ON" else waste_relay.off()
        pub(client, "irrigation/waste/state", "ON" if waste_relay.is_on() else "OFF")
        
    # -- Light Control --
    elif topic.endswith("light/set"):
        light_relay.on() if msg == "ON" else light_relay.off()
        pub(client, "light/state", "ON" if light_relay.is_on() else "OFF")

# --- 4. Network Setup ---
print("Connecting to WiFi...")
if wifi.connect():
    print(f"Connecting to MQTT Broker at {MQTT_BROKER}...")
    client = MQTTClient(CLIENT_ID, MQTT_BROKER, user=MQTT_USER, password=MQTT_PASSWORD, keepalive=60)
    client.set_callback(mqtt_callback)
    
    try:
        client.connect()
        # Subscribe to all command topics
        client.subscribe(f"{BASE_TOPIC}/+/+/set".encode())
        client.subscribe(f"{BASE_TOPIC}/+/set".encode())
        print("✅ MQTT Connected & Subscribed to all /set topics.")
        
        # Publish initial states
        pub(client, "ventilation/mode/state", vent_mode)
        pub(client, "irrigation/mode/state", irrig_mode)
        pub(client, "light/state", "OFF")
        
        last_sensor_read = 0
        last_ha_post = 0
        
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
                    pub(client, "ventilation/fan/state", int(fan.speed))
                    
                # Post telemetry every 60 seconds
                if time.ticks_diff(current_time, last_ha_post) > 60000:
                    last_ha_post = current_time
                    for zone, (t, h) in readings.items():
                        if t is not None:
                            pub(client, f"sensors/{zone}/temp", f"{t:.2f}")
                            pub(client, f"sensors/{zone}/humidity", f"{h:.2f}")
            
            # 3. Irrigation State Machine
            if irrig_mode == "AUTO":
                log = irrig_controller.evaluate()
                if log:
                    print(log)
                    pub(client, "irrigation/drip/state", "ON" if drip_relay.is_on() else "OFF")
                    pub(client, "irrigation/agitate/state", "ON" if agitate_relay.is_on() else "OFF")
                    pub(client, "irrigation/waste/state", "ON" if waste_relay.is_on() else "OFF")
                    
            time.sleep(0.1) # Yield to RTOS
            
    except KeyboardInterrupt:
        print("\nExiting. Ensuring safe state...")
        irrig_controller.force_idle()
        light_relay.off()
        client.disconnect()
    except Exception as e:
        print(f"❌ Crash: {e}")
        irrig_controller.force_idle()
else:
    print("❌ WiFi failed.")
