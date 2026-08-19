import pytest
import sys
from unittest.mock import MagicMock

# Mock machine module before importing lib.drivers.fan
if 'machine' not in sys.modules:
    sys.modules['machine'] = MagicMock()
machine_mock = sys.modules['machine']

from lib.drivers.fan import PWMFan

class TestPWMFan:
    def setup_method(self):
        # Reset mocks before each test
        machine_mock.reset_mock()
        machine_mock.Pin.reset_mock()
        machine_mock.PWM.reset_mock()

    def test_init(self):
        # Initialize PWMFan
        fan = PWMFan(pin=4, freq=25000)

        # Check Pin initialization
        machine_mock.Pin.assert_any_call(4)
        # Check PWM initialization
        machine_mock.PWM.assert_called_once_with(machine_mock.Pin(4), freq=25000)

        # Check default speed
        assert fan.speed == 0
        # Check duty cycle for default speed 0
        fan.pwm.duty.assert_called_with(0)

    def test_set_speed_0(self):
        fan = PWMFan(pin=4)
        fan.set_speed(0)
        assert fan.speed == 0
        fan.pwm.duty.assert_called_with(0)

    def test_set_speed_50(self):
        fan = PWMFan(pin=4)
        fan.set_speed(50)
        assert fan.speed == 50.0
        # 50% of 1023 is 511.5, int(511.5) -> 511
        fan.pwm.duty.assert_called_with(511)

    def test_set_speed_100(self):
        fan = PWMFan(pin=4)
        fan.set_speed(100)
        assert fan.speed == 100.0
        fan.pwm.duty.assert_called_with(1023)

    def test_set_speed_negative(self):
        # Edge case: < 0
        fan = PWMFan(pin=4)
        fan.set_speed(-10)
        assert fan.speed == 0.0
        fan.pwm.duty.assert_called_with(0)

    def test_set_speed_over_100(self):
        # Edge case: > 100
        fan = PWMFan(pin=4)
        fan.set_speed(110)
        assert fan.speed == 100.0
        fan.pwm.duty.assert_called_with(1023)

    def test_deinit(self):
        fan = PWMFan(pin=4)
        fan.deinit()
        fan.pwm.deinit.assert_called_once()
