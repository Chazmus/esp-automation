import secrets

# Device Configuration for Grow Wardrobe Node
DEVICE_NAME = secrets.DEVICE_NAME

# Execution parameters
DEEP_SLEEP_ENABLED = False
SLEEP_SECONDS = 10  # Cycle interval

# Sensor configuration
TEMP_HUMIDITY_SENSORS = {
    "canopy": {
        "sda": 5,
        "scl": 6,
        "type": "AHT20"
    },
    "pot": {
        "sda": 7,
        "scl": 8,
        "type": "AHT20"
    },
    "ambient": {
        "sda": 9,
        "scl": 10,
        "type": "AHT20"
    }
}

SOIL_MOISTURE_SENSOR = {
    "adc_pin": 0,
    "dry": 3800,
    "wet": 1275,
    "power_pin": None,
    "num_samples": 5
}

# Actuator configuration
PWM_FAN = {
    "pin": 12,
    "freq": 25000,
    "target_temp": 28.0  # fan runs at 100% above this, 30% below
}

LIGHT_RELAY = {
    "pin": 13
}
