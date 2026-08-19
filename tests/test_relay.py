import pytest
import sys
from unittest.mock import MagicMock

# Create a mock for machine
mock_machine = MagicMock()

class TestRelay:
    @pytest.fixture(autouse=True)
    def setup_mock(self, monkeypatch):
        # Patch sys.modules to use our mock_machine only for this test class
        monkeypatch.setitem(sys.modules, 'machine', mock_machine)
        # Ensure the module is loaded with the mocked machine module
        monkeypatch.delitem(sys.modules, 'lib.drivers.relay', raising=False)

        from lib.drivers.relay import Relay
        self.Relay = Relay

        yield

        mock_machine.reset_mock()

    def test_init_active_high(self):
        relay = self.Relay(4)
        mock_machine.Pin.assert_called_once_with(4, mock_machine.Pin.OUT)
        relay.pin.value.assert_called_with(0)
        assert relay.active_high is True

    def test_init_active_low(self):
        relay = self.Relay(5, active_high=False)
        mock_machine.Pin.assert_called_once_with(5, mock_machine.Pin.OUT)
        relay.pin.value.assert_called_with(1)
        assert relay.active_high is False

    def test_on_active_high(self):
        relay = self.Relay(4)
        relay.on()
        relay.pin.value.assert_called_with(1)

    def test_off_active_high(self):
        relay = self.Relay(4)
        relay.on()
        relay.off()
        relay.pin.value.assert_called_with(0)

    def test_on_active_low(self):
        relay = self.Relay(4, active_high=False)
        relay.on()
        relay.pin.value.assert_called_with(0)

    def test_off_active_low(self):
        relay = self.Relay(4, active_high=False)
        relay.on()
        relay.off()
        relay.pin.value.assert_called_with(1)
