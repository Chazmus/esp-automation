import pytest
import os
import json
import time
from unittest.mock import MagicMock, patch

# Provide MicroPython time shims for CPython testing
if not hasattr(time, "ticks_ms"):
    time.ticks_ms = lambda: int(time.time() * 1000)
if not hasattr(time, "ticks_diff"):
    time.ticks_diff = lambda a, b: a - b

from lib.controllers.irrigation import IrrigationController, IrrigationState
from lib.config_store import ConfigStore, DEFAULT_CONFIG

def create_mock_relays():
    irrig = MagicMock()
    agitate = MagicMock()
    waste = MagicMock()
    return irrig, agitate, waste

def test_irrigation_init_coco():
    irrig, agitate, waste = create_mock_relays()
    cfg = {
        "medium": "COCO",
        "coco_interval_hours": 3,
        "coco_duration_secs": 20,
        "coco_agitate_mins": 2,
        "coco_drain_wait_mins": 5,
        "coco_drain_secs": 45,
    }
    controller = IrrigationController(irrig, agitate, waste, cfg)
    assert controller.medium == "COCO"
    assert controller.cycle_interval_ms == 3 * 3600 * 1000
    assert controller.irrig_duration_ms == 20 * 1000
    assert controller.agitate_duration_ms == 2 * 60 * 1000
    assert controller.drain_wait_ms == 5 * 60 * 1000
    assert controller.drain_duration_ms == 45 * 1000
    assert controller.state == IrrigationState.IDLE
    irrig.off.assert_called_once()
    agitate.off.assert_called_once()
    waste.off.assert_called_once()

def test_irrigation_coco_cycle_progression():
    irrig, agitate, waste = create_mock_relays()
    cfg = {
        "medium": "COCO",
        "cycle_hours": 1,
        "agitate_mins": 1,
        "irrig_secs": 10,
        "drain_wait_mins": 1,
        "drain_secs": 30,
    }
    controller = IrrigationController(irrig, agitate, waste, cfg)
    irrig.reset_mock()
    agitate.reset_mock()
    waste.reset_mock()

    # 1. Start cycle from IDLE
    controller.last_cycle_start = 0
    with patch("time.ticks_ms", return_value=3600001):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate()
            assert log == "Started Agitation"
            assert controller.state == IrrigationState.AGITATING
            agitate.on.assert_called_once()

    # 2. Agitating -> Irrigating
    controller.state_start_time = 0
    with patch("time.ticks_ms", return_value=60001):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate()
            assert log == "Started Irrigation"
            assert controller.state == IrrigationState.IRRIGATING
            agitate.off.assert_called_once()
            irrig.on.assert_called_once()

    # 3. Irrigating -> Waiting to Drain
    controller.state_start_time = 0
    with patch("time.ticks_ms", return_value=10001):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate()
            assert log == "Finished Irrigation, Waiting to drain"
            assert controller.state == IrrigationState.WAITING_TO_DRAIN
            irrig.off.assert_called_once()

    # 4. Waiting to Drain -> Draining
    controller.state_start_time = 0
    with patch("time.ticks_ms", return_value=60001):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate()
            assert log == "Started Draining"
            assert controller.state == IrrigationState.DRAINING
            waste.on.assert_called_once()

    # 5. Draining -> IDLE
    controller.state_start_time = 0
    with patch("time.ticks_ms", return_value=30001):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate()
            assert log == "Cycle Complete"
            assert controller.state == IrrigationState.IDLE
            waste.off.assert_called_once()

def test_irrigation_soil_mode_trigger_and_target():
    irrig, agitate, waste = create_mock_relays()
    cfg = {
        "medium": "SOIL",
        "soil_trigger_pct": 30.0,
        "soil_target_pct": 50.0,
        "soil_max_water_secs": 30,
        "soil_soak_wait_mins": 60,
    }
    controller = IrrigationController(irrig, agitate, waste, cfg)
    assert controller.medium == "SOIL"

    # Soil moisture above trigger -> stays IDLE
    controller.last_cycle_start = 0
    with patch("time.ticks_ms", return_value=3600000):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate(soil_moisture=35.0)
            assert log is None
            assert controller.state == IrrigationState.IDLE
            irrig.on.assert_not_called()

    # Soil moisture drops below trigger -> starts irrigating
    with patch("time.ticks_ms", return_value=3600001):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate(soil_moisture=25.0)
            assert "Started Soil Irrigation" in log
            assert controller.state == IrrigationState.IRRIGATING
            irrig.on.assert_called_once()

    # Still irrigating, moisture below target
    controller.state_start_time = 0
    with patch("time.ticks_ms", return_value=10000):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate(soil_moisture=40.0)
            assert log is None
            assert controller.state == IrrigationState.IRRIGATING

    # Moisture reaches target -> returns to IDLE
    with patch("time.ticks_ms", return_value=20000):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate(soil_moisture=52.0)
            assert "Finished Soil Irrigation" in log
            assert "Target reached" in log
            assert controller.state == IrrigationState.IDLE
            irrig.off.assert_called()

def test_irrigation_soil_mode_safety_timeout():
    irrig, agitate, waste = create_mock_relays()
    cfg = {
        "medium": "SOIL",
        "soil_trigger_pct": 30.0,
        "soil_target_pct": 50.0,
        "soil_max_water_secs": 15,
        "soil_soak_wait_mins": 60,
    }
    controller = IrrigationController(irrig, agitate, waste, cfg)
    controller.state = IrrigationState.IRRIGATING
    controller.state_start_time = 0

    # Moisture hasn't reached target, but timeout exceeded
    with patch("time.ticks_ms", return_value=16000):
        with patch("time.ticks_diff", side_effect=lambda a, b: a - b):
            log = controller.evaluate(soil_moisture=35.0)
            assert "Finished Soil Irrigation" in log
            assert "Safety timeout" in log
            assert controller.state == IrrigationState.IDLE
            irrig.off.assert_called()

def test_irrigation_dynamic_update_config():
    irrig, agitate, waste = create_mock_relays()
    controller = IrrigationController(irrig, agitate, waste, {"medium": "COCO"})
    assert controller.medium == "COCO"

    controller.update_config({
        "medium": "SOIL",
        "soil_trigger_pct": 25.0,
        "soil_target_pct": 40.0,
    })
    assert controller.medium == "SOIL"
    assert controller.soil_trigger_pct == 25.0
    assert controller.soil_target_pct == 40.0

def test_config_store(tmp_path):
    test_file = str(tmp_path / "test_config.json")
    store = ConfigStore(filename=test_file)
    assert store.get("medium") == "COCO"

    # Save updates
    store.save({"medium": "SOIL", "soil_trigger_pct": 32.0})
    assert store.get("medium") == "SOIL"
    assert store.get("soil_trigger_pct") == 32.0

    # Reload from disk
    new_store = ConfigStore(filename=test_file)
    assert new_store.get("medium") == "SOIL"
    assert new_store.get("soil_trigger_pct") == 32.0
