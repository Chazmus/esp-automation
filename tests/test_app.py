import pytest
import sys
from unittest.mock import MagicMock, patch

# --- Setup MicroPython Mocks ---
# Create global mocks that we can reset in each test
machine_mock = MagicMock()
time_mock = MagicMock()
network_mock = MagicMock()
wifi_mock = MagicMock()
homeassistant_mock = MagicMock()
battery_mock = MagicMock()
usb_mock = MagicMock()
ahtx0_mock = MagicMock()

# Inject mock modules into sys.modules
sys.modules['machine'] = machine_mock
sys.modules['time'] = time_mock
sys.modules['network'] = network_mock
sys.modules['wifi'] = wifi_mock
sys.modules['homeassistant'] = homeassistant_mock
sys.modules['battery'] = battery_mock
sys.modules['usb'] = usb_mock
sys.modules['ahtx0'] = ahtx0_mock

# Now we can import our app under test (it won't exist yet, but we define the tests)
# We can't import `run` directly yet if the file doesn't exist, but we will write the tests.
# Using standard import inside test functions so pytest doesn't crash on import during test discovery

class TestApp:
    def setup_method(self):
        # Save original sys.modules keys to prevent test pollution
        self.original_modules = {}
        for key in ['machine', 'time', 'network', 'wifi', 'homeassistant', 'battery', 'usb', 'ahtx0']:
            if key in sys.modules:
                self.original_modules[key] = sys.modules[key]
            else:
                self.original_modules[key] = None

        # Re-inject our specific mocks into sys.modules
        sys.modules['machine'] = machine_mock
        sys.modules['time'] = time_mock
        sys.modules['network'] = network_mock
        sys.modules['wifi'] = wifi_mock
        sys.modules['homeassistant'] = homeassistant_mock
        sys.modules['battery'] = battery_mock
        sys.modules['usb'] = usb_mock
        sys.modules['ahtx0'] = ahtx0_mock
        
        # Reload lib.app and drivers so they bind to these fresh mocks
        import importlib
        if 'lib.app' in sys.modules:
            importlib.reload(sys.modules['lib.app'])
        if 'lib.drivers.temp_humidity' in sys.modules:
            importlib.reload(sys.modules['lib.drivers.temp_humidity'])
        if 'lib.drivers.soil_moisture' in sys.modules:
            importlib.reload(sys.modules['lib.drivers.soil_moisture'])

        # Reset all mocks before each test
        machine_mock.reset_mock()
        time_mock.reset_mock()
        network_mock.reset_mock()
        wifi_mock.reset_mock()
        homeassistant_mock.reset_mock()
        battery_mock.reset_mock()
        usb_mock.reset_mock()
        ahtx0_mock.reset_mock()
        
        # Default mock returns
        machine_mock.reset_cause.return_value = 0  # Cold boot by default
        wifi_mock.connect.return_value = True
        usb_mock.is_usb_connected.return_value = False
        battery_mock.read_voltage.return_value = 3.8
        battery_mock.get_percentage.return_value = 60.0

    def teardown_method(self):
        # Restore original sys.modules keys
        for key, value in self.original_modules.items():
            if value is None:
                sys.modules.pop(key, None)
            else:
                sys.modules[key] = value
        
        # Reload lib.app and drivers to bind back to the restored modules
        import importlib
        if 'lib.app' in sys.modules:
            importlib.reload(sys.modules['lib.app'])
        if 'lib.drivers.temp_humidity' in sys.modules:
            importlib.reload(sys.modules['lib.drivers.temp_humidity'])
        if 'lib.drivers.soil_moisture' in sys.modules:
            importlib.reload(sys.modules['lib.drivers.soil_moisture'])

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_temp_humidity_cold_boot(self, mock_sleep_ms, mock_sleep):
        # Create mock configuration mimicking devices/temp_humidity/main.py
        class MockConfig:
            DEVICE_NAME = "test_temp_humidity"
            DEEP_SLEEP_ENABLED = True
            SLEEP_SECONDS = 900
            TEMP_HUMIDITY_SENSOR = {
                "sda": 5,
                "scl": 6,
                "type": "AHT20"
            }
            SOIL_MOISTURE_SENSOR = None

        # Setup mock sensor
        sensor_instance = MagicMock()
        sensor_instance.temperature = 22.5
        sensor_instance.relative_humidity = 45.0
        ahtx0_mock.AHT20.return_value = sensor_instance

        # Import run here so that test collection passes even if lib.app has syntax issues initially
        from lib.app import run
        
        # We need to prevent infinite loop during test execution if SLEEP_SECONDS is processed
        # For a deep sleep node, if it enters deep sleep, it raises or calls machine.deepsleep which we can intercept.
        # We'll make machine.deepsleep raise a custom exception to break the loop!
        class DeepSleepExit(BaseException):
            pass
        machine_mock.deepsleep.side_effect = DeepSleepExit()

        with pytest.raises(DeepSleepExit):
            run(MockConfig)

        # Assert cold boot wait occurred (5 seconds)
        time_mock.sleep.assert_any_call(5)

        # Assert AHT20 sensor was initialized and read
        ahtx0_mock.AHT20.assert_called_once()
        assert sensor_instance.temperature == 22.5
        
        # Assert WiFi connection and HA posts
        wifi_mock.connect.assert_called_once()
        homeassistant_mock.post_device_sensor.assert_any_call(
            sensor_suffix="temp",
            state_value="22.50",
            friendly_suffix="Temperature",
            unit_of_measurement="°C",
            device_class="temperature"
        )
        homeassistant_mock.post_device_sensor.assert_any_call(
            sensor_suffix="humidity",
            state_value="45.00",
            friendly_suffix="Humidity",
            unit_of_measurement="%",
            device_class="humidity"
        )
        # Assert battery is posted
        homeassistant_mock.post_device_sensor.assert_any_call(
            sensor_suffix="battery",
            state_value="60.0",
            friendly_suffix="Battery Percentage",
            unit_of_measurement="%",
            device_class="battery"
        )

        # Assert WiFi interface was disabled
        wlan_mock = network_mock.WLAN.return_value
        wlan_mock.active.assert_called_with(False)

        # Assert entered deepsleep
        machine_mock.deepsleep.assert_called_once_with(900 * 1000)

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_multi_temp_humidity_cold_boot(self, mock_sleep_ms, mock_sleep):
        # Create mock configuration mimicking multiple sensor zones
        class MockConfig:
            DEVICE_NAME = "test_multi_temp_humidity"
            DEEP_SLEEP_ENABLED = True
            SLEEP_SECONDS = 900
            TEMP_HUMIDITY_SENSORS = {
                "canopy": {"sda": 5, "scl": 6, "type": "AHT20"},
                "pot": {"sda": 7, "scl": 8, "type": "AHT20"},
                "ambient": {"sda": 9, "scl": 10, "type": "AHT20"}
            }
            SOIL_MOISTURE_SENSOR = None

        # Setup mock sensor
        sensor_instance = MagicMock()
        sensor_instance.temperature = 22.5
        sensor_instance.relative_humidity = 45.0
        ahtx0_mock.AHT20.return_value = sensor_instance

        from lib.app import run
        
        class DeepSleepExit(BaseException):
            pass
        machine_mock.deepsleep.side_effect = DeepSleepExit()

        with pytest.raises(DeepSleepExit):
            run(MockConfig)

        # Assert three sensors were initialized
        assert ahtx0_mock.AHT20.call_count == 3
        
        # Assert WiFi connection and HA posts for each zone
        wifi_mock.connect.assert_called_once()
        for zone in ["canopy", "pot", "ambient"]:
            homeassistant_mock.post_device_sensor.assert_any_call(
                sensor_suffix=f"{zone}_temp",
                state_value="22.50",
                friendly_suffix=f"{zone.capitalize()} Temperature",
                unit_of_measurement="°C",
                device_class="temperature"
            )
            homeassistant_mock.post_device_sensor.assert_any_call(
                sensor_suffix=f"{zone}_humidity",
                state_value="45.00",
                friendly_suffix=f"{zone.capitalize()} Humidity",
                unit_of_measurement="%",
                device_class="humidity"
            )

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_deepsleep_warm_boot_skips_safeguard(self, mock_sleep_ms, mock_sleep):
        # Simulates waking up from deep sleep
        class MockConfig:
            DEVICE_NAME = "test_node"
            DEEP_SLEEP_ENABLED = True
            SLEEP_SECONDS = 900
            TEMP_HUMIDITY_SENSOR = None
            SOIL_MOISTURE_SENSOR = None

        machine_mock.reset_cause.return_value = 4  # DEEPSLEEP_RESET is 4 (or machine.DEEPSLEEP_RESET)
        machine_mock.DEEPSLEEP_RESET = 4
        
        class DeepSleepExit(BaseException):
            pass
        machine_mock.deepsleep.side_effect = DeepSleepExit()

        from lib.app import run
        with pytest.raises(DeepSleepExit):
            run(MockConfig)

        # Verify it skipped the 5 second safeguard sleep
        for call in time_mock.sleep.call_args_list:
            assert call[0][0] != 5

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_always_on_loop(self, mock_sleep_ms, mock_sleep):
        # Simulates a continuous loop device (like grow_wardrobe)
        class MockConfig:
            DEVICE_NAME = "test_always_on"
            DEEP_SLEEP_ENABLED = False
            SLEEP_SECONDS = 10
            TEMP_HUMIDITY_SENSOR = None
            SOIL_MOISTURE_SENSOR = {
                "adc_pin": 0,
                "dry": 3800,
                "wet": 1275,
                "power_pin": 1,
                "num_samples": 1
            }

        # Mock ADC reading for soil moisture
        adc_instance = MagicMock()
        adc_instance.read.return_value = 2500  # Will yield ~51.5% moisture
        machine_mock.ADC.return_value = adc_instance
        machine_mock.Pin.side_effect = lambda pin, *args, **kwargs: MagicMock()

        # We can patch time_mock.sleep_ms to raise an exception
        # only after WiFi connection has been attempted to prevent early termination
        class LoopComplete(BaseException):
            pass
        
        def sleep_ms_side_effect(ms):
            if wifi_mock.connect.called:
                raise LoopComplete()
        
        time_mock.sleep_ms.side_effect = sleep_ms_side_effect

        from lib.app import run
        with pytest.raises(LoopComplete):
            run(MockConfig)

        # Verify HA post of soil moisture
        homeassistant_mock.post_device_sensor.assert_any_call(
            sensor_suffix="moisture",
            state_value="51.5",
            friendly_suffix="Soil Moisture",
            unit_of_measurement="%",
            device_class="humidity"
        )

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_always_on_loop_with_actuators(self, mock_sleep_ms, mock_sleep):
        # Simulates a continuous loop device with actuators configured
        class MockConfig:
            DEVICE_NAME = "test_grow_wardrobe"
            DEEP_SLEEP_ENABLED = False
            SLEEP_SECONDS = 10
            TEMP_HUMIDITY_SENSOR = {
                "sda": 5,
                "scl": 6,
                "type": "AHT20"
            }
            SOIL_MOISTURE_SENSOR = None
            PWM_FAN = {
                "pin": 12,
                "freq": 25000,
                "target_temp": 28.0
            }
            LIGHT_RELAY = {
                "pin": 13
            }

        # Mock TempHumiditySensor reading
        sensor_instance = MagicMock()
        sensor_instance.temperature = 30.5  # Temp > 28.0 (should set fan to 100%)
        sensor_instance.relative_humidity = 50.0
        ahtx0_mock.AHT20.return_value = sensor_instance

        # Pin and PWM mock setup
        machine_mock.Pin.side_effect = lambda pin, *args, **kwargs: MagicMock()
        pwm_instance = MagicMock()
        machine_mock.PWM.return_value = pwm_instance

        class LoopComplete(BaseException):
            pass
        
        def sleep_ms_side_effect(ms):
            if wifi_mock.connect.called:
                raise LoopComplete()
        
        time_mock.sleep_ms.side_effect = sleep_ms_side_effect

        from lib.app import run
        with pytest.raises(LoopComplete):
            run(MockConfig)

        # Verify fan speed was set to 100% (temperature high: 30.5)
        # MicroPython PWM duty is 10-bit: 100% -> 1023
        pwm_instance.duty.assert_called_with(1023)

        # Verify HA post of temperature
        homeassistant_mock.post_device_sensor.assert_any_call(
            sensor_suffix="temp",
            state_value="30.50",
            friendly_suffix="Temperature",
            unit_of_measurement="°C",
            device_class="temperature"
        )

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_advanced_vpd_control_normal(self, mock_sleep_ms, mock_sleep):
        class MockConfig:
            DEVICE_NAME = "test_grow_wardrobe"
            DEEP_SLEEP_ENABLED = False
            SLEEP_SECONDS = 10
            TEMP_HUMIDITY_SENSORS = {
                "canopy": {"sda": 5, "scl": 6, "type": "AHT20"},
                "ambient": {"sda": 9, "scl": 10, "type": "AHT20"}
            }
            SOIL_MOISTURE_SENSOR = None
            PWM_FAN = {
                "pin": 12,
                "freq": 25000,
                "target_vpd": 1.2,
                "kp": 45.0,
                "ki": 0.02,
                "min_speed": 30,
                "max_speed": 100,
                "max_safe_temp": 30.0,
                "min_safe_temp": 16.0,
                "max_safe_humidity": 65.0,
                "leaf_temp_offset": 2.0,
                "ema_alpha": 1.0,  # disable smoothing
                "deadband": 0.05
            }
            LIGHT_RELAY = None

        # Setup side effect to return 25C and 40% humidity (high VPD, should clamp to min)
        canopy_sensor = MagicMock()
        canopy_sensor.temperature = 25.0
        canopy_sensor.relative_humidity = 40.0

        ambient_sensor = MagicMock()
        ambient_sensor.temperature = 20.0
        ambient_sensor.relative_humidity = 50.0

        ahtx0_mock.AHT20.side_effect = [canopy_sensor, ambient_sensor]
        machine_mock.Pin.side_effect = lambda pin, *args, **kwargs: MagicMock()
        pwm_instance = MagicMock()
        machine_mock.PWM.return_value = pwm_instance

        class LoopComplete(BaseException):
            pass

        time_mock.sleep_ms.side_effect = lambda ms: None
        wifi_mock.connect.side_effect = LoopComplete

        from lib.app import run
        with pytest.raises(LoopComplete):
            run(MockConfig)

        # High VPD (1.54 kPa) is above target VPD (1.2 kPa), so it's too dry -> fan should clamp to min_speed (30%)
        # duty = int(30/100 * 1023) = 306
        pwm_instance.duty.assert_called_with(306)

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_advanced_vpd_control_temp_override(self, mock_sleep_ms, mock_sleep):
        class MockConfig:
            DEVICE_NAME = "test_grow_wardrobe"
            DEEP_SLEEP_ENABLED = False
            SLEEP_SECONDS = 10
            TEMP_HUMIDITY_SENSORS = {
                "canopy": {"sda": 5, "scl": 6, "type": "AHT20"},
                "ambient": {"sda": 9, "scl": 10, "type": "AHT20"}
            }
            SOIL_MOISTURE_SENSOR = None
            PWM_FAN = {
                "pin": 12,
                "freq": 25000,
                "target_vpd": 1.2,
                "max_safe_temp": 30.0,
                "min_safe_temp": 16.0,
                "max_safe_humidity": 65.0,
                "ema_alpha": 1.0
            }
            LIGHT_RELAY = None

        # Canopy temperature is 31.0 (> max_safe_temp of 30.0)
        canopy_sensor = MagicMock()
        canopy_sensor.temperature = 31.0
        canopy_sensor.relative_humidity = 50.0

        ambient_sensor = MagicMock()
        ambient_sensor.temperature = 20.0
        ambient_sensor.relative_humidity = 50.0

        ahtx0_mock.AHT20.side_effect = [canopy_sensor, ambient_sensor]
        machine_mock.Pin.side_effect = lambda pin, *args, **kwargs: MagicMock()
        pwm_instance = MagicMock()
        machine_mock.PWM.return_value = pwm_instance

        class LoopComplete(BaseException):
            pass

        time_mock.sleep_ms.side_effect = lambda ms: None
        wifi_mock.connect.side_effect = LoopComplete

        from lib.app import run
        with pytest.raises(LoopComplete):
            run(MockConfig)

        # High temperature override should trigger 100% fan speed (1023 duty)
        pwm_instance.duty.assert_called_with(1023)

    @patch('time.sleep')
    @patch('time.sleep_ms')
    def test_run_advanced_vpd_control_ambient_clamp(self, mock_sleep_ms, mock_sleep):
        class MockConfig:
            DEVICE_NAME = "test_grow_wardrobe"
            DEEP_SLEEP_ENABLED = False
            SLEEP_SECONDS = 10
            TEMP_HUMIDITY_SENSORS = {
                "canopy": {"sda": 5, "scl": 6, "type": "AHT20"},
                "ambient": {"sda": 9, "scl": 10, "type": "AHT20"}
            }
            SOIL_MOISTURE_SENSOR = None
            PWM_FAN = {
                "pin": 12,
                "freq": 25000,
                "target_vpd": 1.2,
                "min_speed": 30,
                "max_speed": 100,
                "max_safe_temp": 35.0,
                "min_safe_temp": 16.0,
                "max_safe_humidity": 95.0,
                "leaf_temp_offset": 2.0,
                "ema_alpha": 1.0,
                "deadband": 0.05
            }
            LIGHT_RELAY = None

        # Canopy: 24C, 80% humidity (low VPD, i.e. too humid)
        # SVP leaf (22C) = 2.644 kPa. SVP air (24C) = 2.985 kPa.
        # AVP air = 2.985 * 0.80 = 2.388 kPa.
        # VPD = 2.644 - 2.388 = 0.256 kPa (much lower than target 1.2, error > 0).
        canopy_sensor = MagicMock()
        canopy_sensor.temperature = 24.0
        canopy_sensor.relative_humidity = 80.0

        # Ambient: 24C, 90% humidity (wetter than canopy!)
        # AVP ambient = 2.985 * 0.90 = 2.686 kPa (which is >= AVP air 2.388 kPa).
        ambient_sensor = MagicMock()
        ambient_sensor.temperature = 24.0
        ambient_sensor.relative_humidity = 90.0

        ahtx0_mock.AHT20.side_effect = [canopy_sensor, ambient_sensor]
        machine_mock.Pin.side_effect = lambda pin, *args, **kwargs: MagicMock()
        pwm_instance = MagicMock()
        machine_mock.PWM.return_value = pwm_instance

        class LoopComplete(BaseException):
            pass

        time_mock.sleep_ms.side_effect = lambda ms: None
        wifi_mock.connect.side_effect = LoopComplete

        from lib.app import run
        with pytest.raises(LoopComplete):
            run(MockConfig)

        # Ambient check should clamp speed to min_speed (30%) because ambient is wetter
        pwm_instance.duty.assert_called_with(306)
