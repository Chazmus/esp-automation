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

PWM_FAN = {
    "pin": 12,
    "freq": 25000,
    "target_temp": 28.0,         # fallback threshold
    
    # Advanced VPD PI control parameters
    "target_vpd": 1.2,           # Target VPD in kPa
    "kp": 45.0,                  # Proportional constant (fan % per kPa error)
    "ki": 0.02,                  # Integral constant (fan % per kPa error * second)
    "min_speed": 30,             # Minimum fan speed percentage
    "max_speed": 100,            # Maximum fan speed percentage
    
    # Biological safety constraints
    "max_safe_temp": 30.0,       # Force 100% fan speed above this
    "min_safe_temp": 16.0,       # Force minimum fan speed below this
    "max_safe_humidity": 65.0,   # Force 100% fan speed above this (bud rot failsafe)
    
    # VPD Specific settings
    "leaf_temp_offset": 2.0,     # Leaf is assumed 2C cooler than canopy air
    "ema_alpha": 0.2,            # Exponential moving average filter coefficient
    "deadband": 0.05             # VPD error deadband in kPa
}

LIGHT_RELAY = {
    "pin": 13
}
