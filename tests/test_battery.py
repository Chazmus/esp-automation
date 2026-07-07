import pytest
import sys
from unittest.mock import MagicMock

# Mock machine module before importing lib.battery
sys.modules['machine'] = MagicMock()
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
