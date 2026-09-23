import secrets

# Device Configuration for Temperature/Humidity Node
DEVICE_NAME = secrets.DEVICE_NAME

# Execution parameters
DEEP_SLEEP_ENABLED = False  # Continuous execution (mains powered)
SLEEP_SECONDS = 30  # 30 seconds interval between HA updates

# Dual Sensor Configuration
TEMP_HUMIDITY_SENSORS = {
    "sensor1": {"sda": 5, "scl": 6, "type": "AHT20"},
    "sensor2": {"sda": 7, "scl": 8, "type": "AHT20"},
}

SOIL_MOISTURE_SENSOR = None
