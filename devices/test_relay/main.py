import time
from machine import Pin
import secrets
from umqtt.simple import MQTTClient

# GPIO 2 for the Irrigation Pump Relay
relay_pin = Pin(2, Pin.OUT)

# Active-Low relay logic
RELAY_ON = 0
RELAY_OFF = 1

# MQTT Configuration
# We use getattr in case you haven't added these to secrets.py yet.
# It will try to extract the IP address from your HA_URL as a fallback!
MQTT_BROKER = getattr(secrets, 'MQTT_BROKER', secrets.HA_URL.replace("http://", "").split(":")[0])
MQTT_USER = getattr(secrets, 'MQTT_USER', 'mqtt_user')
MQTT_PASSWORD = getattr(secrets, 'MQTT_PASSWORD', '')

COMMAND_TOPIC = b"wardrobe/test_relay/set"
STATE_TOPIC = b"wardrobe/test_relay/state"
CLIENT_ID = b"esp32_test_relay"

def mqtt_callback(topic, msg):
    print(f"Received message on topic {topic}: {msg}")
    
    if topic == COMMAND_TOPIC:
        if msg == b"ON":
            relay_pin.value(RELAY_ON)
            client.publish(STATE_TOPIC, b"ON")
            print("Relay turned ON via MQTT")
        elif msg == b"OFF":
            relay_pin.value(RELAY_OFF)
            client.publish(STATE_TOPIC, b"OFF")
            print("Relay turned OFF via MQTT")

# Ensure it starts OFF
relay_pin.value(RELAY_OFF)

print(f"Connecting to MQTT Broker at {MQTT_BROKER}...")
client = MQTTClient(CLIENT_ID, MQTT_BROKER, user=MQTT_USER, password=MQTT_PASSWORD)
client.set_callback(mqtt_callback)

try:
    client.connect()
    client.subscribe(COMMAND_TOPIC)
    print(f"✅ Connected to MQTT and listening on: {COMMAND_TOPIC}")
    
    # Publish initial state to HA so the button shows 'Off' initially
    client.publish(STATE_TOPIC, b"OFF")
    
    while True:
        # Check for new MQTT messages (non-blocking)
        client.check_msg()
        
        # Sleep briefly to prevent hoarding CPU resources
        time.sleep(0.1)
        
except KeyboardInterrupt:
    print("\nTest stopped. Ensuring relay is OFF.")
    relay_pin.value(RELAY_OFF)
except Exception as e:
    print(f"❌ Error: {e}")
    relay_pin.value(RELAY_OFF)
finally:
    try:
        client.disconnect()
    except:
        pass
