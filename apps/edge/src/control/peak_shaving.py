"""
Peak Shaving — local demand management.
Protects the client from exceeding their contracted demand limit.
Works 100% offline. Priority: CONTRACTUAL (level 3).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from src.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class PeakShavingDecision:
    action: str        # "DISCHARGE", "CHARGE", "IDLE"
    power_kw: float
    reason: str
    current_demand_kw: float
    demand_limit_kw: float


class PeakShavingController:
    """
    Monitors demand and discharges the battery when demand approaches the limit.
    Prevents demand overrun charges (~R$ 50k/month for large industrial clients).

    States:
    - MONITORING: demand below trigger, battery may charge during recharge window
    - PEAK_SHAVING: demand above trigger, discharging to protect limit
    - RECOVERING: demand fell below hysteresis, stopping discharge gracefully
    """

    def __init__(
        self,
        demand_limit_kw: float = 100.0,
        trigger_percent: float = 80.0,        # Activate at 80% of limit
        min_soc_percent: float = 20.0,        # Don't discharge below this
        ramp_rate_kw_per_sec: float = 10.0,
        recharge_start_hour: int = 22,        # Start recharging at 22:00
        recharge_end_hour: int = 6,           # Stop recharging at 06:00
        max_discharge_kw: float = 50.0,
        max_charge_kw: float = 30.0,          # Conservative charge rate
    ):
        self._demand_limit = demand_limit_kw
        self._trigger_pct = trigger_percent
        self._min_soc = min_soc_percent
        self._ramp_rate = ramp_rate_kw_per_sec
        self._recharge_start = recharge_start_hour
        self._recharge_end = recharge_end_hour
        self._max_discharge = max_discharge_kw
        self._max_charge = max_charge_kw

        self._trigger_kw = demand_limit_kw * (trigger_percent / 100.0)
        self._hysteresis_kw = self._trigger_kw * 0.7  # Stop at 70% of trigger
        self._currently_shaving = False

    def update_config(self, demand_limit_kw: float, trigger_percent: float) -> None:
        """Update from cloud config. Safe to call at runtime."""
        self._demand_limit = demand_limit_kw
        self._trigger_pct = trigger_percent
        self._trigger_kw = demand_limit_kw * (trigger_percent / 100.0)
        self._hysteresis_kw = self._trigger_kw * 0.7
        logger.info("peak_shaving_config_updated",
                    limit=demand_limit_kw, trigger=trigger_percent)

    def _is_recharge_window(self) -> bool:
        """Check if current time is within the nightly recharge window."""
        hour = datetime.now().hour
        if self._recharge_start > self._recharge_end:
            # Crosses midnight (e.g., 22:00 to 06:00)
            return hour >= self._recharge_start or hour < self._recharge_end
        return self._recharge_start <= hour < self._recharge_end

    def decide(
        self,
        current_demand_kw: float,  # Current facility demand from meter
        soc: float,
        max_battery_power_kw: float,
    ) -> PeakShavingDecision:
        """
        Main peak shaving logic.
        current_demand_kw: measured demand at the point of connection.
        soc: current battery state of charge.
        """
        discharge_limit = min(self._max_discharge, max_battery_power_kw)

        # ── Case 1: Demand above trigger → START or CONTINUE shaving ───────
        if current_demand_kw > self._trigger_kw:
            if soc <= self._min_soc:
                logger.warning("peak_shaving_cannot_discharge_low_soc",
                               soc=soc, min_soc=self._min_soc)
                self._currently_shaving = False
                return PeakShavingDecision(
                    action="IDLE",
                    power_kw=0.0,
                    reason=f"Demand {current_demand_kw:.1f}kW > trigger, but SOC {soc:.1f}% too low",
                    current_demand_kw=current_demand_kw,
                    demand_limit_kw=self._demand_limit,
                )

            # Calculate required discharge to bring demand below trigger
            deficit = current_demand_kw - self._trigger_kw
            power = min(deficit, discharge_limit)
            self._currently_shaving = True

            logger.info("peak_shaving_active",
                        demand=current_demand_kw, trigger=self._trigger_kw, power=power)
            return PeakShavingDecision(
                action="DISCHARGE",
                power_kw=round(power, 1),
                reason=f"Demand {current_demand_kw:.1f}kW > trigger {self._trigger_kw:.1f}kW — shaving {power:.1f}kW",
                current_demand_kw=current_demand_kw,
                demand_limit_kw=self._demand_limit,
            )

        # ── Case 2: Demand dropped below hysteresis → STOP shaving ─────────
        if self._currently_shaving and current_demand_kw < self._hysteresis_kw:
            self._currently_shaving = False
            logger.info("peak_shaving_stopped", demand=current_demand_kw)
            return PeakShavingDecision(
                action="IDLE",
                power_kw=0.0,
                reason=f"Demand recovered: {current_demand_kw:.1f}kW < hysteresis {self._hysteresis_kw:.1f}kW",
                current_demand_kw=current_demand_kw,
                demand_limit_kw=self._demand_limit,
            )

        # ── Case 3: Continue shaving (demand between hysteresis and trigger) ─
        if self._currently_shaving:
            return PeakShavingDecision(
                action="DISCHARGE",
                power_kw=round(min(self._max_discharge * 0.3, discharge_limit), 1),
                reason=f"Peak shaving holding ({current_demand_kw:.1f}kW in hysteresis zone)",
                current_demand_kw=current_demand_kw,
                demand_limit_kw=self._demand_limit,
            )

        # ── Case 4: Demand safe + recharge window → CHARGE for tomorrow ─────
        if self._is_recharge_window() and soc < 80.0:
            charge_power = min(self._max_charge, max_battery_power_kw)
            return PeakShavingDecision(
                action="CHARGE",
                power_kw=round(charge_power, 1),
                reason=f"Nightly recharge window (SOC {soc:.1f}% → 80%)",
                current_demand_kw=current_demand_kw,
                demand_limit_kw=self._demand_limit,
            )

        # ── Case 5: Normal operation, no action needed ───────────────────────
        return PeakShavingDecision(
            action="IDLE",
            power_kw=0.0,
            reason=f"Demand {current_demand_kw:.1f}kW below trigger {self._trigger_kw:.1f}kW",
            current_demand_kw=current_demand_kw,
            demand_limit_kw=self._demand_limit,
        )
