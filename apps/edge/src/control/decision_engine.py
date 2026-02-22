"""
Local Decision Engine — the edge controller's brain.

Three operating modes:
  ONLINE:    Cloud is available → receives setpoints via MQTT, executes them
  AUTONOMOUS: Cloud offline >15min → makes local decisions using cached data
  SAFE_MODE: Critical error → minimal operation, maintain SOC 20-80%

Priority order (same as cloud UnifiedDecisionEngine):
  1. SAFETY      → handled by SafetyManager BEFORE calling this engine
  2. GRID_CODE   → black start, grid failure response
  3. CONTRACTUAL → peak shaving (protect demand limit)
  4. ECONOMIC    → energy arbitrage
  5. LONGEVITY   → battery health preservation
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from src.config import EdgeConfig
from src.control.arbitrage import ArbitrageController
from src.control.black_start import BlackStartController, GridState
from src.control.peak_shaving import PeakShavingController
from src.control.solar_self import SolarSelfConsumptionController
from src.data.cache_manager import CacheManager
from src.safety.safety_manager import TelemetrySnapshot
from src.utils.logger import get_logger
from src.utils.metrics import DECISIONS_TOTAL

logger = get_logger(__name__)


class EngineMode(Enum):
    ONLINE = "ONLINE"
    AUTONOMOUS = "AUTONOMOUS"
    SAFE_MODE = "SAFE_MODE"


class LocalDecisionEngine:
    """
    Edge Decision Engine.
    Coordinates all optimization strategies with priority ordering.
    """

    def __init__(self, config: EdgeConfig):
        self._config = config
        self._site_id = config.site.id
        self._mode = EngineMode.ONLINE
        self._cache = CacheManager()
        self._last_cloud_contact = time.monotonic()
        self._cloud_timeout = config.control.cloud_timeout_minutes * 60

        opt = config.optimization
        self._arbitrage = ArbitrageController(
            buy_threshold=opt.arbitrage.buy_threshold_price,
            sell_threshold=opt.arbitrage.sell_threshold_price,
            min_soc_for_sell=opt.arbitrage.min_soc_for_sell,
            max_soc_for_buy=opt.arbitrage.max_soc_for_buy,
            max_charge_power_kw=config.battery.max_charge_power_kw,
            max_discharge_power_kw=config.battery.max_discharge_power_kw,
        )

        self._peak_shaving = PeakShavingController(
            demand_limit_kw=opt.peak_shaving.demand_limit_kw,
            trigger_percent=opt.peak_shaving.trigger_percent,
            min_soc_percent=opt.peak_shaving.min_soc_percent,
            max_discharge_kw=config.battery.max_discharge_power_kw,
        )

        self._solar = SolarSelfConsumptionController(
            min_solar_excess_kw=opt.solar.min_solar_excess_kw,
            target_soc=opt.solar.target_soc,
            night_discharge=opt.solar.night_discharge,
            max_charge_kw=config.battery.max_charge_power_kw,
            max_discharge_kw=config.battery.max_discharge_power_kw,
        )

        self._black_start = BlackStartController(site_id=self._site_id)

    @property
    def mode(self) -> EngineMode:
        return self._mode

    def receive_cloud_command(self, command: dict) -> None:
        """Process setpoint received from cloud via MQTT."""
        self._last_cloud_contact = time.monotonic()
        if self._mode != EngineMode.ONLINE:
            logger.info("engine_mode_restored_to_online", previous=self._mode.value)
        self._mode = EngineMode.ONLINE
        self._cache.set_cloud_setpoint(command)

        # Apply any config updates embedded in the command
        if "prices" in command:
            self._cache.update_prices(command["prices"])
            self._arbitrage.update_price_table(command["prices"])
        if "peak_shaving" in command:
            cfg = command["peak_shaving"]
            self._peak_shaving.update_config(
                cfg.get("demand_limit_kw", 100),
                cfg.get("trigger_percent", 80),
            )

    def update_config(self, config_update: dict) -> None:
        """Handle config update from cloud MQTT retain message."""
        self._last_cloud_contact = time.monotonic()
        self._cache.update_optimization_config(config_update)

        if "prices" in config_update:
            self._arbitrage.update_price_table(config_update["prices"])
        if "load_forecast" in config_update:
            self._cache.update_load_forecast(config_update["load_forecast"])

    def _check_mode(self) -> None:
        """Update operating mode based on cloud contact time."""
        elapsed = time.monotonic() - self._last_cloud_contact
        if self._mode == EngineMode.ONLINE and elapsed > self._cloud_timeout:
            self._mode = EngineMode.AUTONOMOUS
            logger.warning(
                "engine_switched_to_autonomous",
                cloud_offline_minutes=elapsed / 60,
            )

    async def decide(self, telemetry: TelemetrySnapshot) -> dict:
        """
        Main decision function. Called every optimization_interval_seconds.
        Returns a decision dict with: action, power_kw, priority, reason, mode.
        """
        self._check_mode()

        max_power = min(
            self._config.battery.max_charge_power_kw,
            self._config.battery.max_discharge_power_kw,
        )

        # ─── PRIORITY 2: GRID_CODE — Black start ─────────────────────────
        bs_status = await self._black_start.process(
            frequency=telemetry.frequency,
            grid_voltage=telemetry.grid_voltage,
            soc=telemetry.soc,
        )

        if bs_status.state != GridState.GRID_CONNECTED:
            decision = self._grid_code_decision(bs_status, telemetry.soc)
            DECISIONS_TOTAL.labels(site_id=self._site_id, action=decision["action"]).inc()
            return decision

        # ─── PRIORITY 3: CONTRACTUAL — Peak shaving ──────────────────────
        # Note: demand_kw would come from a CT meter; here we estimate from power
        estimated_demand_kw = abs(telemetry.power_kw) + 20.0  # Rough estimate
        ps_decision = self._peak_shaving.decide(
            current_demand_kw=estimated_demand_kw,
            soc=telemetry.soc,
            max_battery_power_kw=max_power,
        )

        if ps_decision.action in ("CHARGE", "DISCHARGE"):
            return self._build_decision(
                action=ps_decision.action,
                power_kw=ps_decision.power_kw,
                priority="CONTRACTUAL",
                reason=ps_decision.reason,
            )

        # ─── PRIORITY 4: ECONOMIC — Arbitrage or Solar ───────────────────
        if self._mode == EngineMode.ONLINE and self._cache.is_cloud_setpoint_valid():
            # ONLINE: Execute cloud setpoint
            setpoint = self._cache.cloud_setpoint.value or {}
            return self._build_decision(
                action=setpoint.get("action", "IDLE"),
                power_kw=setpoint.get("power_kw", 0.0),
                priority="ECONOMIC",
                reason=f"Cloud setpoint: {setpoint.get('reason', 'optimized')}",
            )

        if self._mode == EngineMode.SAFE_MODE:
            return self._safe_mode_decision(telemetry.soc)

        # AUTONOMOUS: Use local algorithms
        # Solar first (if solar data available)
        solar_gen = self._cache.solar_forecast.get()
        hour = datetime.now().hour
        solar_kw = solar_gen[hour] if len(solar_gen) > hour else 0.0

        if solar_kw > 0.5:
            solar_decision = self._solar.decide(
                soc=telemetry.soc,
                solar_generation_kw=solar_kw,
                load_kw=abs(telemetry.power_kw),
                max_battery_power_kw=max_power,
            )
            if solar_decision.action in ("CHARGE", "DISCHARGE"):
                return self._build_decision(
                    action=solar_decision.action,
                    power_kw=solar_decision.power_kw,
                    priority="ECONOMIC",
                    reason=f"[AUTONOMOUS] {solar_decision.reason}",
                )

        # Arbitrage with cached prices
        arb_decision = self._arbitrage.decide(
            soc=telemetry.soc,
            max_power_kw=max_power,
        )

        return self._build_decision(
            action=arb_decision.action,
            power_kw=arb_decision.power_kw,
            priority="ECONOMIC",
            reason=f"[AUTONOMOUS] {arb_decision.reason}",
        )

    def enter_safe_mode(self, reason: str) -> None:
        logger.critical("engine_entering_safe_mode", reason=reason)
        self._mode = EngineMode.SAFE_MODE

    def _safe_mode_decision(self, soc: float) -> dict:
        """Minimal operation: keep SOC between 20-80%."""
        safe = self._config.optimization.safe_mode
        if soc > safe.max_soc:
            return self._build_decision("DISCHARGE", 10.0, "LONGEVITY",
                                        f"[SAFE MODE] SOC {soc:.1f}% > {safe.max_soc}%")
        if soc < safe.min_soc:
            return self._build_decision("CHARGE", 10.0, "LONGEVITY",
                                        f"[SAFE MODE] SOC {soc:.1f}% < {safe.min_soc}%")
        return self._build_decision("IDLE", 0.0, "LONGEVITY", "[SAFE MODE] SOC within safe range")

    def _grid_code_decision(self, bs_status: Any, soc: float) -> dict:
        """Translate black start state into a decision."""
        from src.control.black_start import GridState
        state = bs_status.state

        if state == GridState.GRID_FAILURE_DETECTED:
            return self._build_decision("IDLE", 0.0, "GRID_CODE",
                                        "Grid failure detected — preparing transfer")
        elif state == GridState.TRANSFERRING:
            return self._build_decision("IDLE", 0.0, "GRID_CODE",
                                        "Transferring to island mode")
        elif state == GridState.ISLAND_MODE:
            # Discharge to serve loads, conserve based on SOC
            discharge_power = min(
                self._config.battery.max_discharge_power_kw,
                max(10.0, soc * 0.5),  # Discharge proportional to SOC
            )
            return self._build_decision(
                "DISCHARGE", discharge_power, "GRID_CODE",
                f"Island mode — serving loads (SOC {soc:.1f}%)"
            )
        elif state in (GridState.RECONNECTING, GridState.SYNCHRONIZING):
            return self._build_decision("IDLE", 0.0, "GRID_CODE",
                                        f"Grid recovery: {state.value}")
        return self._build_decision("IDLE", 0.0, "GRID_CODE", "Grid state nominal")

    def _build_decision(
        self,
        action: str,
        power_kw: float,
        priority: str,
        reason: str,
    ) -> dict:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "power_kw": round(power_kw, 2),
            "priority": priority,
            "reason": reason,
            "mode": self._mode.value,
            "soc": None,  # Will be filled by control_loop
            "confidence": 1.0,
            "duration_min": 5.0,
        }
