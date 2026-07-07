import urequests
import json
import secrets

def post_device_sensor(sensor_suffix, state_value, friendly_suffix=None, unit_of_measurement=None, device_class=None):
    """
    Helper function to post a sensor state for the current device.
    Automatically prepends 'esp32_{secrets.DEVICE_NAME}_' to the sensor ID
    and 'ESP32 {secrets.DEVICE_NAME} ' to the friendly name.
    """
    sensor_id = f"esp32_{secrets.DEVICE_NAME}_{sensor_suffix}"
    friendly_name = f"ESP32 {secrets.DEVICE_NAME} {friendly_suffix}" if friendly_suffix else None

    return post_state(
        sensor_id=sensor_id,
        state_value=state_value,
        friendly_name=friendly_name,
        unit_of_measurement=unit_of_measurement,
        device_class=device_class
    )


def post_state(sensor_id, state_value, friendly_name=None, unit_of_measurement=None, device_class=None):
    """
    Posts a sensor state to Home Assistant's REST API.
    The entity 'sensor.<sensor_id>' will be created or updated in Home Assistant.
    
    Returns True on success, False on failure.
    """
    # Check if host URL is set to placeholder
    if secrets.HA_URL == "http://your-homeassistant-ip:8123" or secrets.HA_TOKEN == "your-long-lived-access-token":
        print("⚠️  Home Assistant credentials are still set to placeholders in lib/secrets.py.")
        return False

    url = f"{secrets.HA_URL}/api/states/sensor.{sensor_id}"
    
    headers = {
        "Authorization": f"Bearer {secrets.HA_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Construct attributes dict
    attributes = {}
    if friendly_name:
        attributes["friendly_name"] = friendly_name
    if unit_of_measurement:
        attributes["unit_of_measurement"] = unit_of_measurement
    if device_class:
        attributes["device_class"] = device_class
        
    payload = {
        "state": str(state_value),
        "attributes": attributes
    }
    
    response = None
    try:
        # Convert payload to json string and encode to raw UTF-8 bytes.
        # This is critical in MicroPython to ensure Content-Length matches the byte count
        # of unicode characters (like the degree symbol °) rather than the character count!
        data_bytes = json.dumps(payload).encode('utf-8')
        
        # Send HTTP POST request
        print(f"Posting sensor.{sensor_id} state to Home Assistant...")
        response = urequests.post(url, headers=headers, data=data_bytes)
        
        # Check response status
        if response.status_code in (200, 201):
            print(f"✅ Successfully posted sensor.{sensor_id}: {state_value}")
            success = True
        else:
            print(f"❌ Failed to post (HTTP {response.status_code}): {response.text}")
            success = False
            
    except Exception as e:
        print(f"❌ Connection error posting to Home Assistant: {e}")
        success = False
    finally:
        # Clean up socket descriptors (critical in MicroPython to avoid running out of RAM/sockets)
        if response is not None:
            try:
                response.close()
            except:
                pass
                
    return success
