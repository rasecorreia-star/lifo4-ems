"""
Tests for the Safety Manager.
Verifies that every hard limit triggers the correct action.
Also verifies that limits cannot be changed at runtime.
"""
import pytest

from src.safety.safety_manager import SafetyAction, SafetyManager, TelemetrySnapshot
from src.safety import limits


def _ok_snapshot(**overrides) -> TelemetrySnapshot:
    """Return a valid TelemetrySnapshot (all values within safe range)."""
    defaults = dict(
        soc=50.0,
        soh=98.0,
        voltage=48.0,
        current=10.0,
        power_kw=5.0,
        temp_min=20.0,
        temp_max=30.0,
        temp_avg=25.0,
        frequency=60.0,
        grid_voltage=220.0,
        cell_voltage_min=3.20,
        cell_voltage_max=3.22,
        max_charge_current_a=200.0,
        max_discharge_current_a=200.0,
    )
    defaults.update(overrides)
    return TelemetrySnapshot(**defaults)


class TestSafetyManagerOk:
    def test_normal_operation_returns_ok(self):
        sm = SafetyManager()
        result = sm.check(_ok_snapshot())
        assert result.action == SafetyAction.OK
        assert result.is_ok

    def test_ok_does_not_block_optimization(self):
        sm = SafetyManager()
        result = sm.check(_ok_snapshot())
        assert not result.blocks_optimization


class TestCellVoltage:
    def test_cell_overvoltage_triggers_emergency_stop(self):
        sm = SafetyManager()
        snap = _ok_snapshot(cell_voltage_max=limits.CELL_VOLTAGE_MAX_V + 0.01)
        result = sm.check(snap)
        assert result.action == SafetyAction.EMERGENCY_STOP
        assert result.severity == "critical"
        assert result.requires_immediate_stop

    def test_cell_voltage_at_max_limit_is_ok(self):
        sm = SafetyManager()
        snap = _ok_snapshot(cell_voltage_max=limits.CELL_VOLTAGE_MAX_V)
        result = sm.check(snap)
        assert result.action == SafetyAction.OK

    def test_cell_undervoltage_triggers_stop_discharge(self):
        sm = SafetyManager()
        snap = _ok_snapshot(cell_voltage_min=limits.CELL_VOLTAGE_MIN_V - 0.01)
        result = sm.check(snap)
        assert result.action == SafetyAction.STOP_DISCHARGE
        assert result.severity == "critical"

    def test_cell_imbalance_triggers_reduce_power(self):
        sm = SafetyManager()
        # delta > 100mV = 0.1V
        snap = _ok_snapshot(cell_voltage_min=3.00, cell_voltage_max=3.12)
        result = sm.check(snap)
        assert result.action == SafetyAction.REDUCE_POWER


class TestTemperature:
    def test_overtemperature_triggers_emergency_stop(self):
        sm = SafetyManager()
        snap = _ok_snapshot(temp_max=limits.PACK_TEMP_MAX_C + 1)
        result = sm.check(snap)
        assert result.action == SafetyAction.EMERGENCY_STOP
        assert result.requires_immediate_stop

    def test_undertemperature_triggers_stop_all(self):
        sm = SafetyManager()
        snap = _ok_snapshot(temp_min=limits.PACK_TEMP_MIN_C - 1)
        result = sm.check(snap)
        assert result.action == SafetyAction.STOP_ALL
        assert result.requires_immediate_stop

    def test_high_temp_warning_triggers_reduce_power(self):
        sm = SafetyManager()
        snap = _ok_snapshot(temp_max=limits.PACK_TEMP_WARN_C + 1)
        result = sm.check(snap)
        assert result.action == SafetyAction.REDUCE_POWER


class TestSOC:
    def test_soc_below_absolute_min_stops_discharge(self):
        sm = SafetyManager()
        snap = _ok_snapshot(soc=limits.SOC_ABSOLUTE_MIN_PCT - 1)
        result = sm.check(snap)
        assert result.action == SafetyAction.STOP_DISCHARGE
        assert result.severity == "high"

    def test_soc_above_absolute_max_stops_charge(self):
        sm = SafetyManager()
        snap = _ok_snapshot(soc=limits.SOC_ABSOLUTE_MAX_PCT + 0.5)
        result = sm.check(snap)
        assert result.action == SafetyAction.STOP_CHARGE

    def test_soc_at_limits_is_ok(self):
        sm = SafetyManager()
        snap = _ok_snapshot(soc=limits.SOC_ABSOLUTE_MIN_PCT)
        assert sm.check(snap).action == SafetyAction.OK
        snap = _ok_snapshot(soc=limits.SOC_ABSOLUTE_MAX_PCT)
        assert sm.check(snap).action == SafetyAction.OK


class TestSafetyPriority:
    def test_overvoltage_takes_priority_over_soc_min(self):
        """Cell overvoltage should return EMERGENCY_STOP, not STOP_DISCHARGE."""
        sm = SafetyManager()
        snap = _ok_snapshot(
            cell_voltage_max=limits.CELL_VOLTAGE_MAX_V + 0.1,
            soc=limits.SOC_ABSOLUTE_MIN_PCT - 1,
        )
        result = sm.check(snap)
        assert result.action == SafetyAction.EMERGENCY_STOP

    def test_overtemperature_takes_priority_over_imbalance(self):
        sm = SafetyManager()
        snap = _ok_snapshot(
            temp_max=limits.PACK_TEMP_MAX_C + 1,
            cell_voltage_min=3.00,
            cell_voltage_max=3.12,
        )
        result = sm.check(snap)
        assert result.action == SafetyAction.EMERGENCY_STOP


class TestHardLimitsImmutable:
    def test_cell_voltage_limits_are_constants(self):
        """Verify limits are defined as module constants (not mutable class attributes)."""
        assert isinstance(limits.CELL_VOLTAGE_MIN_V, float)
        assert isinstance(limits.CELL_VOLTAGE_MAX_V, float)
        assert limits.CELL_VOLTAGE_MIN_V == 2.5
        assert limits.CELL_VOLTAGE_MAX_V == 3.65

    def test_safety_manager_has_no_limit_setters(self):
        """SafetyManager must not expose methods to change hard limits."""
        sm = SafetyManager()
        assert not hasattr(sm, "set_cell_voltage_max")
        assert not hasattr(sm, "set_limits")
        assert not hasattr(sm, "override_limits")
        assert not hasattr(sm, "update_limits")
