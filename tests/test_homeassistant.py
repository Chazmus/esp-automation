import pytest
import sys
from unittest.mock import MagicMock, patch
import json

# Mock urequests and secrets
urequests_mock = MagicMock()
sys.modules['urequests'] = urequests_mock
secrets_mock = MagicMock()
secrets_mock.HA_URL = "http://fake_url:8123"
secrets_mock.HA_TOKEN = "fake_token"
secrets_mock.DEVICE_NAME = "test_device"
sys.modules['secrets'] = secrets_mock

from lib.homeassistant import post_state, post_device_sensor

class TestHomeAssistant:
    def setup_method(self):
        urequests_mock.post.reset_mock()
        urequests_mock.post.side_effect = None

    def test_post_state_success(self):
        # Mock successful response
        response_mock = MagicMock()
        response_mock.status_code = 200
        urequests_mock.post.return_value = response_mock

        success = post_state(
            sensor_id="test_sensor",
            state_value="25.0",
            friendly_name="Test Sensor",
            unit_of_measurement="°C",
            device_class="temperature"
        )

        assert success is True
        urequests_mock.post.assert_called_once()
        args, kwargs = urequests_mock.post.call_args

        # Verify URL and Headers
        assert args[0] == "http://fake_url:8123/api/states/sensor.test_sensor"
        assert kwargs["headers"] == {
            "Authorization": "Bearer fake_token",
            "Content-Type": "application/json"
        }

        # Verify Payload
        payload = json.loads(kwargs["data"].decode('utf-8'))
        assert payload["state"] == "25.0"
        assert payload["attributes"]["friendly_name"] == "Test Sensor"
        assert payload["attributes"]["unit_of_measurement"] == "°C"
        assert payload["attributes"]["device_class"] == "temperature"

    def test_post_state_failure(self):
        # Mock failed response
        response_mock = MagicMock()
        response_mock.status_code = 404
        response_mock.text = "Not Found"
        urequests_mock.post.return_value = response_mock

        success = post_state(sensor_id="test_sensor", state_value="25.0")

        assert success is False

    def test_post_state_exception(self):
        urequests_mock.post.side_effect = Exception("Connection Error")

        success = post_state(sensor_id="test_sensor", state_value="25.0")

        assert success is False

    @patch('lib.homeassistant.post_state')
    def test_post_device_sensor(self, mock_post_state):
        mock_post_state.return_value = True

        success = post_device_sensor(
            sensor_suffix="temp",
            state_value="22.5",
            friendly_suffix="Temperature",
            unit_of_measurement="°C",
            device_class="temperature"
        )

        assert success is True
        mock_post_state.assert_called_once_with(
            sensor_id="esp32_test_device_temp",
            state_value="22.5",
            friendly_name="ESP32 test_device Temperature",
            unit_of_measurement="°C",
            device_class="temperature",
            extra_attributes=None
        )

    def test_post_state_with_extra_attributes(self):
        response_mock = MagicMock()
        response_mock.status_code = 200
        urequests_mock.post.return_value = response_mock

        success = post_state(
            sensor_id="test_sensor_attrs",
            state_value="Normal",
            extra_attributes={
                "severity": "normal",
                "alert_count": 0
            }
        )

        assert success is True
        args, kwargs = urequests_mock.post.call_args
        payload = json.loads(kwargs["data"].decode('utf-8'))
        
        assert payload["state"] == "Normal"
        assert payload["attributes"]["severity"] == "normal"
        assert payload["attributes"]["alert_count"] == 0
