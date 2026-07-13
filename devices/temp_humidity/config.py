import secrets

# Device Configuration for Temperature/Humidity Node
DEVICE_NAME = secrets.DEVICE_NAME

# Execution parameters
DEEP_SLEEP_ENABLED = True
SLEEP_SECONDS = 900  # 15 minutes sleep interval

# Sensor configuration
TEMP_HUMIDITY_SENSOR = {
    "sda": 5,
    "scl": 6,
    "type": "AHT20"
}

SOIL_MOISTURE_SENSOR = None
