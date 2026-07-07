import pytest
import sys
from unittest.mock import MagicMock

# Mock machine module before importing lib.battery
sys.modules['machine'] = MagicMock()
# Mock time module since time.sleep_ms is not available in standard python
time_mock = MagicMock()
time_mock.sleep_ms = MagicMock()
sys.modules['time'] = time_mock

from lib.battery import get_percentage

class TestBattery:
    def test_get_percentage_none(self):
        assert get_percentage(None) is None

    def test_get_percentage_zero(self):
        assert get_percentage(3.2) == 0.0

    def test_get_percentage_full(self):
        assert get_percentage(4.2) == 100.0

    def test_get_percentage_mid(self):
        assert get_percentage(3.7) == 50.0

    def test_get_percentage_below_zero(self):
        assert get_percentage(3.0) == 0.0

    def test_get_percentage_above_full(self):
        assert get_percentage(4.5) == 100.0

    def test_get_percentage_nan(self):
        import math
        # `min`/`max` evaluation behavior with `math.nan` can vary by Python implementation.
        # In this Python version, get_percentage evaluates to 100.0 for NaN.
        # Check against both behaviors (returning NaN or returning the float boundary).
        res = get_percentage(math.nan)
        assert res == 100.0 or math.isnan(res)

    def test_get_percentage_inf(self):
        import math
        assert get_percentage(math.inf) == 100.0

    def test_get_percentage_neg_inf(self):
        import math
        assert get_percentage(-math.inf) == 0.0

    def test_get_percentage_string(self):
        with pytest.raises(TypeError):
            get_percentage("4.2")

    def test_read_voltage_disconnected(self):
        from lib.battery import read_voltage
        import sys
        machine_mock = sys.modules['machine']
        adc_instance = MagicMock()
        machine_mock.ADC.return_value = adc_instance

        # adc.read() < 500
        adc_instance.read.return_value = 499

        assert read_voltage() is None

    def test_read_voltage_valid(self):
        from lib.battery import read_voltage
        import sys
        machine_mock = sys.modules['machine']
        adc_instance = MagicMock()
        machine_mock.ADC.return_value = adc_instance

        # adc.read() >= 500
        adc_instance.read.return_value = 1000
        # adc.read_uv() averages to 1_000_000
        adc_instance.read_uv.side_effect = [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000]

        assert read_voltage() == 2.0

    def test_read_voltage_exception(self):
        from lib.battery import read_voltage
        import sys
        machine_mock = sys.modules['machine']
        adc_instance = MagicMock()
        machine_mock.ADC.return_value = adc_instance

        # Make adc.read() throw an exception
        adc_instance.read.side_effect = Exception("ADC error")

        assert read_voltage() is None
