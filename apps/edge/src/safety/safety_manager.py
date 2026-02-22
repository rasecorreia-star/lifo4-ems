"""
Safety Manager — Layer 1 of the edge controller.

This class ALWAYS runs before any optimization decision.
It has ZERO dependency on cloud, ML, or config overrides.
Hard limits are defined in limits.py as constants.

If any limit is violated, the appropriate safety action is returned
IMMEDIATELY and UNCONDITIONALLY — no optimization runs.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from src.safety.limits import (
    CELL_DELTA_MAX_MV,
    CELL_VOLTAGE_MAX_V,
    CELL_VOLTAGE_MIN_V,
    PACK_TEMP_MAX_C,
    PACK_TEMP_MIN_C,
    PACK_TEMP_WARN_C,
    SOC_ABSOLUTE_MAX_PCT,
    SOC_ABSOLUTE_MIN_PCT,
)
from src.utils.logger import get_logger

logger = get_logger(__name__)


class SafetyAction(Enum):
    OK = "OK"
    EMERGENCY_STOP = "EMERGENCY_STOP"
    STOP_CHARGE = "STOP_CHARGE"
    STOP_DISCHARGE = "STOP_DISCHARGE"
    STOP_ALL = "STOP_ALL"
    REDUCE_POWER = "REDUCE_POWER"
    REDUCE_CURRENT = "REDUCE_CURRENT"


@dataclass
class SafetyResult:
    action: SafetyAction
    reason: str
    severity: str  # "critical", "high", "medium"
    value: Optional[float] = None
    limit: Optional[float] = None

    @property
    def is_ok(self) -> bool:
        return self.action == SafetyAction.OK

    @property
    def blocks_optimization(self) -> bool:
        return self.action != SafetyAction.OK

    @property
    def requires_immediate_stop(self) -> bool:
        return self.action in (
            SafetyAction.EMERGENCY_STOP,
            SafetyAction.STOP_ALL,
        )


@dataclass
class TelemetrySnapshot:
    """Minimal telemetry data needed for safety checks."""
    soc: float                          # State of Charge (%)
    soh: float                          # State of Health (%)
    voltage: float                      # Pack voltage (V)
    current: float                      # Pack current (A, + charge)
    power_kw: float                     # Active power (kW)
    temp_min: float                     # Min cell temp (°C)
    temp_max: float                     # Max cell temp (°C)
    temp_avg: float                     # Avg pack temp (°C)
    cell_voltage_min: float             # Min cell voltage (V)
    cell_voltage_max: float             # Max cell voltage (V)
    frequency: float = 60.0            # Grid frequency (Hz)
    grid_voltage: float = 220.0        # Grid voltage (V)
    max_charge_current_a: float = 200.0
    max_discharge_current_a: float = 200.0


class SafetyManager:
    """
    Hardcoded safety layer. Cannot be disabled or reconfigured remotely.
    Call check() before ANY optimization decision.
    """

    def check(self, telemetry: TelemetrySnapshot) -> SafetyResult:
        """
        Run all safety checks in priority order.
        Returns first violation found (highest priority first).
        """
        # 1. Cell overvoltage → stop charging immediately
        if telemetry.cell_voltage_max > CELL_VOLTAGE_MAX_V:
            result = SafetyResult(
                action=SafetyAction.EMERGENCY_STOP,
                reason=f"Cell overvoltage: {telemetry.cell_voltage_max:.3f}V > {CELL_VOLTAGE_MAX_V}V",
                severity="critical",
                value=telemetry.cell_voltage_max,
                limit=CELL_VOLTAGE_MAX_V,
            )
            logger.critical("safety_violation", **result.__dict__)
            return result

        # 2. Cell undervoltage → stop discharging immediately
        if telemetry.cell_voltage_min < CELL_VOLTAGE_MIN_V:
            result = SafetyResult(
                action=SafetyAction.STOP_DISCHARGE,
                reason=f"Cell undervoltage: {telemetry.cell_voltage_min:.3f}V < {CELL_VOLTAGE_MIN_V}V",
                severity="critical",
                value=telemetry.cell_voltage_min,
                limit=CELL_VOLTAGE_MIN_V,
            )
            logger.critical("safety_violation", **result.__dict__)
            return result

        # 3. Overtemperature → emergency stop
        if telemetry.temp_max > PACK_TEMP_MAX_C:
            result = SafetyResult(
                action=SafetyAction.EMERGENCY_STOP,
                reason=f"Overtemperature: {telemetry.temp_max:.1f}°C > {PACK_TEMP_MAX_C}°C",
                severity="critical",
                value=telemetry.temp_max,
                limit=PACK_TEMP_MAX_C,
            )
            logger.critical("safety_violation", **result.__dict__)
            return result

        # 4. Undertemperature → stop all operations
        if telemetry.temp_min < PACK_TEMP_MIN_C:
            result = SafetyResult(
                action=SafetyAction.STOP_ALL,
                reason=f"Undertemperature: {telemetry.temp_min:.1f}°C < {PACK_TEMP_MIN_C}°C",
                severity="critical",
                value=telemetry.temp_min,
                limit=PACK_TEMP_MIN_C,
            )
            logger.critical("safety_violation", **result.__dict__)
            return result

        # 5. SOC absolute minimum → stop discharge
        if telemetry.soc < SOC_ABSOLUTE_MIN_PCT:
            result = SafetyResult(
                action=SafetyAction.STOP_DISCHARGE,
                reason=f"SOC absolute minimum: {telemetry.soc:.1f}% < {SOC_ABSOLUTE_MIN_PCT}%",
                severity="high",
                value=telemetry.soc,
                limit=SOC_ABSOLUTE_MIN_PCT,
            )
            logger.warning("safety_violation", **result.__dict__)
            return result

        # 6. SOC absolute maximum → stop charge
        if telemetry.soc > SOC_ABSOLUTE_MAX_PCT:
            result = SafetyResult(
                action=SafetyAction.STOP_CHARGE,
                reason=f"SOC absolute maximum: {telemetry.soc:.1f}% > {SOC_ABSOLUTE_MAX_PCT}%",
                severity="high",
                value=telemetry.soc,
                limit=SOC_ABSOLUTE_MAX_PCT,
            )
            logger.warning("safety_violation", **result.__dict__)
            return result

        # 7. Cell imbalance → reduce power
        cell_delta_mv = (telemetry.cell_voltage_max - telemetry.cell_voltage_min) * 1000
        if cell_delta_mv > CELL_DELTA_MAX_MV:
            result = SafetyResult(
                action=SafetyAction.REDUCE_POWER,
                reason=f"Cell imbalance: {cell_delta_mv:.0f}mV > {CELL_DELTA_MAX_MV}mV",
                severity="medium",
                value=cell_delta_mv,
                limit=CELL_DELTA_MAX_MV,
            )
            logger.warning("safety_violation", **result.__dict__)
            return result

        # 8. High temperature warning → reduce power to 50%
        if telemetry.temp_max > PACK_TEMP_WARN_C:
            result = SafetyResult(
                action=SafetyAction.REDUCE_POWER,
                reason=f"High temperature warning: {telemetry.temp_max:.1f}°C > {PACK_TEMP_WARN_C}°C",
                severity="medium",
                value=telemetry.temp_max,
                limit=PACK_TEMP_WARN_C,
            )
            logger.warning("safety_violation", **result.__dict__)
            return result

        # All checks passed
        return SafetyResult(
            action=SafetyAction.OK,
            reason="All safety checks passed",
            severity="none",
        )
