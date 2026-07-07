import pytest
import sys
from unittest.mock import MagicMock

# Mock network and secrets modules before importing lib.wifi
sys.modules['network'] = MagicMock()
sys.modules['secrets'] = MagicMock()
from lib.wifi import get_status_desc

class TestWifiStatus:
    def test_get_status_desc_idle(self):
        assert get_status_desc(1000) == "STAT_IDLE"

    def test_get_status_desc_connecting(self):
        assert get_status_desc(1001) == "STAT_CONNECTING"

    def test_get_status_desc_wrong_password(self):
        assert get_status_desc(202) == "STAT_WRONG_PASSWORD"

    def test_get_status_desc_no_ap_found(self):
        assert get_status_desc(201) == "STAT_NO_AP_FOUND"

    def test_get_status_desc_assoc_fail(self):
        assert get_status_desc(203) == "STAT_ASSOC_FAIL"

    def test_get_status_desc_handshake_timeout(self):
        assert get_status_desc(204) == "STAT_HANDSHAKE_TIMEOUT"

    def test_get_status_desc_got_ip(self):
        assert get_status_desc(1010) == "STAT_GOT_IP"

    def test_get_status_desc_unknown(self):
        assert get_status_desc(9999) == "UNKNOWN (9999)"

    def test_get_status_desc_negative(self):
        assert get_status_desc(-1) == "UNKNOWN (-1)"
