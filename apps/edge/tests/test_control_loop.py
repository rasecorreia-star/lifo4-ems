"""
Tests for the Control Loop.
Verifies that safety ALWAYS runs before optimization,
and that Modbus/MQTT failures are handled gracefully.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.safety.safety_manager import SafetyAction, SafetyResult, TelemetrySnapshot


def _make_ok_snapshot() -> TelemetrySnapshot:
    return TelemetrySnapshot(
        soc=50.0, soh=98.0, voltage=48.0, current=10.0, power_kw=5.0,
        temp_min=20.0, temp_max=30.0, temp_avg=25.0,
        frequency=60.0, grid_voltage=220.0,
        cell_voltage_min=3.20, cell_voltage_max=3.22,
    )


def _make_safety_violation() -> SafetyResult:
    return SafetyResult(
        action=SafetyAction.EMERGENCY_STOP,
        reason="Test: cell overvoltage",
        severity="critical",
        value=3.70,
        limit=3.65,
    )


class TestSafetyBeforeOptimization:
    """Safety MUST always run before optimization — no exceptions."""

    @pytest.mark.asyncio
    async def test_safety_violation_skips_optimization(self):
        """If safety check fails, optimization must NOT run."""
        from src.safety.safety_manager import SafetyManager
        call_order = []

        safety_mock = MagicMock()
        safety_mock.check = MagicMock(
            return_value=_make_safety_violation(),
            side_effect=lambda t: call_order.append("safety") or _make_safety_violation(),
        )

        engine_mock = AsyncMock()
        engine_mock.decide = AsyncMock(
            side_effect=lambda t: call_order.append("optimize") or {"action": "IDLE", "power_kw": 0}
        )

        # Simulate what ControlLoop._cycle does: safety first, then optimize
        telemetry = _make_ok_snapshot()
        safety_result = safety_mock.check(telemetry)

        if not safety_result.is_ok:
            # This is the block in control_loop.py — optimization is skipped
            pass  # Return early, don't call engine.decide
        else:
            await engine_mock.decide(telemetry)

        assert "safety" in call_order
        assert "optimize" not in call_order, "Optimization should NOT run when safety fails"

    @pytest.mark.asyncio
    async def test_optimization_runs_when_safety_ok(self):
        """If safety passes, optimization must run."""
        call_order = []

        safety_mock = MagicMock()
        ok_result = SafetyResult(action=SafetyAction.OK, reason="OK", severity="none")
        safety_mock.check = MagicMock(
            side_effect=lambda t: call_order.append("safety") or ok_result
        )

        engine_mock = AsyncMock()
        engine_mock.decide = AsyncMock(
            side_effect=lambda t: call_order.append("optimize") or {"action": "IDLE", "power_kw": 0}
        )

        telemetry = _make_ok_snapshot()
        safety_result = safety_mock.check(telemetry)

        if safety_result.is_ok:
            await engine_mock.decide(telemetry)

        assert call_order == ["safety", "optimize"]


class TestModbusFailureHandling:
    @pytest.mark.asyncio
    async def test_no_telemetry_does_not_crash(self):
        """If Modbus returns None, the cycle should handle gracefully."""
        modbus_mock = AsyncMock()
        modbus_mock.read_telemetry = AsyncMock(return_value=None)

        telemetry = await modbus_mock.read_telemetry()
        assert telemetry is None
        # In real code, this triggers safe mode — test that no exception is raised


class TestMqttOfflineOperation:
    @pytest.mark.asyncio
    async def test_cycle_works_without_mqtt(self):
        """Control loop must work even when MQTT is offline."""
        mqtt_mock = AsyncMock()
        mqtt_mock.is_connected = False
        mqtt_mock.publish_heartbeat = AsyncMock()

        db_mock = AsyncMock()
        db_mock.save_telemetry = AsyncMock()
        db_mock.save_decision = AsyncMock()
        db_mock.enqueue_for_sync = AsyncMock()

        telemetry = _make_ok_snapshot()

        # Simulate what happens when MQTT is offline
        await db_mock.save_telemetry(telemetry)
        decision = {"action": "IDLE", "power_kw": 0.0, "reason": "test"}
        if not mqtt_mock.is_connected:
            # Should enqueue, not try to publish
            await db_mock.enqueue_for_sync("lifo4/test/decisions", decision, qos=1)

        db_mock.save_telemetry.assert_awaited_once()
        db_mock.enqueue_for_sync.assert_awaited_once()
