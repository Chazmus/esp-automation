import pytest
from unittest.mock import MagicMock
from lib.controllers.vpd import calculate_svp, VPDController

def test_calculate_svp():
    # Test None temp
    assert calculate_svp(None) == 0.0
    
    # Test typical temperature values (SVP in kPa)
    # At 20C, SVP is approx 2.338 kPa
    svp_20 = calculate_svp(20.0)
    assert 2.3 < svp_20 < 2.4
    
    # At 0C, SVP is approx 0.611 kPa
    svp_0 = calculate_svp(0.0)
    assert 0.6 < svp_0 < 0.62

def test_vpd_controller_init():
    fan = MagicMock()
    config = {
        "target_vpd": 1.5,
        "kp": 30.0,
        "ki": 0.05,
        "min_speed": 25,
        "max_speed": 95,
        "max_safe_temp": 32.0,
        "min_safe_temp": 15.0,
        "max_safe_humidity": 70.0,
        "leaf_temp_offset": 1.5,
        "deadband": 0.02,
        "target_temp": 26.0
    }
    
    controller = VPDController(fan, config)
    assert controller.target_vpd == 1.5
    assert controller.kp == 30.0
    assert controller.ki == 0.05
    assert controller.min_speed == 25
    assert controller.max_speed == 95
    assert controller.max_safe_temp == 32.0
    assert controller.min_safe_temp == 15.0
    assert controller.max_safe_humidity == 70.0
    assert controller.leaf_offset == 1.5
    assert controller.deadband == 0.02
    assert controller.target_temp == 26.0
    assert controller.integral_error == 0.0

def test_evaluate_none_inputs():
    fan = MagicMock()
    controller = VPDController(fan, {})
    
    assert controller.evaluate(None, 50.0) is None
    assert controller.evaluate(25.0, None) is None
    fan.set_speed.assert_not_called()

def test_evaluate_temp_too_high_override():
    fan = MagicMock()
    config = {"max_safe_temp": 30.0}
    controller = VPDController(fan, config)
    
    res = controller.evaluate(canopy_temp=31.0, canopy_humidity=50.0)
    assert "OVERRIDE" in res
    assert "Temp" in res
    fan.set_speed.assert_called_once_with(100)

def test_evaluate_humidity_too_high_override():
    fan = MagicMock()
    config = {"max_safe_humidity": 65.0}
    controller = VPDController(fan, config)
    
    res = controller.evaluate(canopy_temp=25.0, canopy_humidity=70.0)
    assert "OVERRIDE" in res
    assert "Hum" in res
    fan.set_speed.assert_called_once_with(100)

def test_evaluate_temp_too_low_override():
    fan = MagicMock()
    config = {"min_safe_temp": 16.0, "min_speed": 30}
    controller = VPDController(fan, config)
    
    res = controller.evaluate(canopy_temp=15.0, canopy_humidity=50.0)
    assert "OVERRIDE" in res
    assert "Temp" in res
    fan.set_speed.assert_called_once_with(30)

def test_evaluate_ambient_clamp():
    fan = MagicMock()
    config = {
        "target_vpd": 1.2,
        "min_speed": 30,
        "max_speed": 100,
        "max_safe_temp": 35.0,
        "min_safe_temp": 16.0,
        "max_safe_humidity": 95.0,
        "leaf_temp_offset": 2.0,
        "deadband": 0.05
    }
    controller = VPDController(fan, config)
    
    # Canopy: 24C, 80% humidity (low VPD)
    # Ambient: 24C, 90% humidity (wetter than canopy)
    res = controller.evaluate(
        canopy_temp=24.0,
        canopy_humidity=80.0,
        ambient_temp=24.0,
        ambient_humidity=90.0
    )
    
    assert "CLAMP" in res
    fan.set_speed.assert_called_once_with(30)

def test_evaluate_normal_vpd_proportional():
    fan = MagicMock()
    config = {
        "target_vpd": 1.2,
        "kp": 40.0,
        "ki": 0.0,
        "min_speed": 30,
        "max_speed": 100,
        "max_safe_temp": 35.0,
        "min_safe_temp": 16.0,
        "max_safe_humidity": 95.0,
        "leaf_temp_offset": 2.0,
        "deadband": 0.0
    }
    controller = VPDController(fan, config)
    
    # Calculate expected VPD at 25C, 60% humidity
    # Leaf temp = 23C. SVP leaf (23C) = 2.810 kPa
    # SVP air (25C) = 3.169 kPa. AVP air = 3.169 * 0.6 = 1.901 kPa
    # VPD = 2.810 - 1.901 = 0.909 kPa
    # Error = 1.2 - 0.909 = 0.291 kPa
    # p_term = 40.0 * 0.291 = 11.64
    # Expected speed = 30 + 11.64 = 41.64 -> 41%
    controller.evaluate(canopy_temp=25.0, canopy_humidity=60.0)
    
    # Check that set_speed was called with approximately 41
    called_speed = fan.set_speed.call_args[0][0]
    assert 40 <= called_speed <= 43

def test_evaluate_integral_windup():
    fan = MagicMock()
    config = {
        "target_vpd": 1.2,
        "kp": 10.0,
        "ki": 5.0,
        "min_speed": 30,
        "max_speed": 100,
        "max_safe_temp": 35.0,
        "min_safe_temp": 16.0,
        "max_safe_humidity": 95.0,
        "leaf_temp_offset": 2.0,
        "deadband": 0.0
    }
    controller = VPDController(fan, config)
    
    # Large positive error triggers integral term growth
    # Let's run multiple steps to wind up the integral term
    for _ in range(50):
        controller.evaluate(canopy_temp=25.0, canopy_humidity=60.0, dt_seconds=2.0)
        
    # Max integral term clamp is max_speed - min_speed = 70.0
    assert controller.integral_error == 70.0

def test_vpd_controller_dry_mode():
    fan = MagicMock()
    config = {
        "target_vpd": 1.2,
        "leaf_temp_offset": 2.0,
        "min_speed": 30,
        "dry_target_vpd": 0.9,
        "dry_leaf_temp_offset": 0.0,
        "dry_min_speed": 20,
        "dry_max_safe_humidity": 65.0
    }
    controller = VPDController(fan, config)
    assert controller.mode == "GROW"
    assert controller.target_vpd == 1.2
    assert controller.leaf_offset == 2.0
    assert controller.min_speed == 30
    
    controller.set_mode("DRY")
    assert controller.mode == "DRY"
    assert controller.target_vpd == 0.9
    assert controller.leaf_offset == 0.0
    assert controller.min_speed == 20
    assert controller.active_max_safe_humidity == 65.0
    
    # Humidity > 65% in DRY mode triggers override
    res = controller.evaluate(canopy_temp=20.0, canopy_humidity=68.0)
    assert "OVERRIDE (DRY)" in res
    fan.set_speed.assert_called_with(100)

    # Switch back to GROW
    controller.set_mode("GROW")
    assert controller.mode == "GROW"
    assert controller.target_vpd == 1.2
    assert controller.min_speed == 30

