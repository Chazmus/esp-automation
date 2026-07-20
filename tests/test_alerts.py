import pytest
from lib.alerts import AlertManager

class DummyConfig:
    ALERTS = {
        "temp_high": 30.0,
        "temp_low": 16.0,
        "humidity_high": 65.0,
        "humidity_low": 30.0
    }

def test_alert_manager_normal():
    config = DummyConfig()
    manager = AlertManager(config)
    
    # 22C and 50% relative humidity is completely normal
    readings = {
        "canopy": (22.0, 50.0)
    }
    
    status, severity, active = manager.evaluate(readings)
    assert status == "Normal"
    assert severity == "normal"
    assert len(active) == 0

def test_alert_manager_critical_high_temp():
    config = DummyConfig()
    manager = AlertManager(config)
    
    # 31C is above 30.0 limit
    readings = {
        "canopy": (31.0, 50.0)
    }
    
    status, severity, active = manager.evaluate(readings)
    assert "High Temp" in status
    assert severity == "critical"
    assert len(active) == 1
    assert active[0] == "High Temp (31.0°C)"

def test_alert_manager_multiple_alerts():
    config = DummyConfig()
    manager = AlertManager(config)
    
    # 15C is below 16.0, 70% humidity is above 65.0
    readings = {
        "canopy": (15.0, 70.0)
    }
    
    status, severity, active = manager.evaluate(readings)
    assert "Low Temp" in status
    assert "High Humidity" in status
    assert severity == "critical"
    assert len(active) == 2

def test_alert_manager_extensibility():
    config = DummyConfig()
    manager = AlertManager(config)
    
    # Register a new custom rule checking for soil moisture (e.g. alert if below 15%)
    def custom_soil_check(readings):
        moisture = readings.get("soil_moisture")
        if moisture is not None and moisture < 15.0:
            return [f"Soil Dry ({moisture:.1f}%)"], "warning"
        return [], "normal"
        
    manager.register_rule(custom_soil_check)
    
    # Test case: normal temp/humidity but dry soil
    readings = {
        "canopy": (22.0, 50.0),
        "soil_moisture": 12.0
    }
    
    status, severity, active = manager.evaluate(readings)
    assert status == "Soil Dry (12.0%)"
    assert severity == "warning"
    assert len(active) == 1
