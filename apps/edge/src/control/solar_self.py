"""
Solar self-consumption optimization.
Maximizes use of local solar generation. 100% offline capable.
"""
from __future__ import annotations

from dataclasses import dataclass

from src.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class SolarDecision:
    action: str
    power_kw: float
    reason: str
    solar_excess_kw: float


class SolarSelfConsumptionController:
    """
    Manages battery charging from solar excess and discharging at night.
    Works offline — no cloud needed. Configured via YAML/MQTT.
    """

    def __init__(
        self,
        min_solar_excess_kw: float = 1.0,
        target_soc: float = 80.0,
        night_discharge: bool = True,
        max_charge_kw: float = 50.0,
        max_discharge_kw: float = 50.0,
    ):
        self._min_excess = min_solar_excess_kw
        self._target_soc = target_soc
        self._night_discharge = night_discharge
        self._max_charge = max_charge_kw
        self._max_discharge = max_discharge_kw

    def decide(
        self,
        soc: float,
        solar_generation_kw: float,
        load_kw: float,
        max_battery_power_kw: float,
    ) -> SolarDecision:
        solar_excess = solar_generation_kw - load_kw

        # ── Charge from solar excess ────────────────────────────────────────
        if solar_excess >= self._min_excess and soc < self._target_soc:
            charge_power = min(solar_excess, self._max_charge, max_battery_power_kw)
            return SolarDecision(
                action="CHARGE",
                power_kw=round(charge_power, 1),
                reason=f"Solar excess {solar_excess:.1f}kW — charging to target {self._target_soc}%",
                solar_excess_kw=solar_excess,
            )

        # ── Discharge at night to serve load ────────────────────────────────
        if self._night_discharge and solar_generation_kw < 0.5 and soc > 20.0:
            serve_power = min(load_kw, self._max_discharge, max_battery_power_kw)
            if serve_power > 0.5:  # Only if meaningful
                return SolarDecision(
                    action="DISCHARGE",
                    power_kw=round(serve_power, 1),
                    reason=f"Night discharge: serving {serve_power:.1f}kW load from battery",
                    solar_excess_kw=solar_excess,
                )

        return SolarDecision(
            action="IDLE",
            power_kw=0.0,
            reason=f"Solar: {solar_generation_kw:.1f}kW, load: {load_kw:.1f}kW, no action needed",
            solar_excess_kw=solar_excess,
        )
