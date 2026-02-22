"""
Tests for the Decision Engine and sub-controllers.
Verifies priority ordering, offline operation, and all scenarios.
"""
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.control.arbitrage import ArbitrageController
from src.control.peak_shaving import PeakShavingController
from src.data.cache_manager import CacheManager, DEFAULT_PRICES
from src.safety.safety_manager import TelemetrySnapshot


def _make_snapshot(**overrides) -> TelemetrySnapshot:
    defaults = dict(
        soc=50.0, soh=98.0, voltage=48.0, current=10.0, power_kw=20.0,
        temp_min=20.0, temp_max=30.0, temp_avg=25.0,
        frequency=60.0, grid_voltage=220.0,
        cell_voltage_min=3.20, cell_voltage_max=3.22,
    )
    defaults.update(overrides)
    return TelemetrySnapshot(**defaults)


# ─── Arbitrage Tests ────────────────────────────────────────────────────────

class TestArbitrageController:
    def test_cheap_price_charges(self):
        ctrl = ArbitrageController(buy_threshold=0.45, max_charge_power_kw=50)
        ctrl.update_price_table({h: 0.30 for h in range(24)})  # Always cheap
        decision = ctrl.decide(soc=50.0, max_power_kw=50.0)
        assert decision.action == "CHARGE"
        assert decision.power_kw > 0

    def test_expensive_price_discharges(self):
        ctrl = ArbitrageController(sell_threshold=0.85, max_discharge_power_kw=50)
        ctrl.update_price_table({h: 1.20 for h in range(24)})  # Always expensive
        decision = ctrl.decide(soc=70.0, max_power_kw=50.0)
        assert decision.action == "DISCHARGE"
        assert decision.power_kw > 0

    def test_neutral_price_idles(self):
        ctrl = ArbitrageController(buy_threshold=0.45, sell_threshold=0.85)
        ctrl.update_price_table({h: 0.65 for h in range(24)})  # Mid-range
        decision = ctrl.decide(soc=50.0, max_power_kw=50.0)
        assert decision.action == "IDLE"
        assert decision.power_kw == 0.0

    def test_high_soc_prevents_charge(self):
        ctrl = ArbitrageController(buy_threshold=0.45, max_soc_for_buy=90.0)
        ctrl.update_price_table({h: 0.20 for h in range(24)})  # Very cheap
        decision = ctrl.decide(soc=95.0, max_power_kw=50.0)  # SOC above max
        assert decision.action == "IDLE"

    def test_low_soc_prevents_discharge(self):
        ctrl = ArbitrageController(sell_threshold=0.85, min_soc_for_sell=30.0)
        ctrl.update_price_table({h: 1.50 for h in range(24)})  # Very expensive
        decision = ctrl.decide(soc=25.0, max_power_kw=50.0)  # SOC below min
        assert decision.action == "IDLE"

    def test_uses_default_prices_when_no_cache(self):
        """Without cloud update, uses DEFAULT_PRICE_TABLE (no crash)."""
        ctrl = ArbitrageController()
        decision = ctrl.decide(soc=50.0, max_power_kw=50.0)
        assert decision.action in ("CHARGE", "DISCHARGE", "IDLE")

    def test_invalid_price_table_ignored(self):
        ctrl = ArbitrageController()
        ctrl.update_price_table({0: 0.3})  # Too few hours
        # Should not raise, should still work
        decision = ctrl.decide(soc=50.0, max_power_kw=50.0)
        assert decision.action in ("CHARGE", "DISCHARGE", "IDLE")


# ─── Peak Shaving Tests ─────────────────────────────────────────────────────

class TestPeakShavingController:
    def test_demand_above_trigger_discharges(self):
        ctrl = PeakShavingController(demand_limit_kw=100, trigger_percent=80)
        decision = ctrl.decide(current_demand_kw=90.0, soc=60.0, max_battery_power_kw=50.0)
        assert decision.action == "DISCHARGE"
        assert decision.power_kw > 0

    def test_demand_below_trigger_idles(self):
        ctrl = PeakShavingController(demand_limit_kw=100, trigger_percent=80)
        decision = ctrl.decide(current_demand_kw=70.0, soc=60.0, max_battery_power_kw=50.0)
        assert decision.action == "IDLE"

    def test_low_soc_prevents_peak_shaving(self):
        ctrl = PeakShavingController(demand_limit_kw=100, trigger_percent=80, min_soc_percent=20)
        decision = ctrl.decide(current_demand_kw=95.0, soc=15.0, max_battery_power_kw=50.0)
        # Cannot discharge — would go below minimum
        assert decision.action == "IDLE"
        assert "too low" in decision.reason.lower() or "soc" in decision.reason.lower()

    def test_discharge_power_proportional_to_deficit(self):
        ctrl = PeakShavingController(demand_limit_kw=100, trigger_percent=80)
        # Demand = 90, trigger = 80, deficit = 10kW
        decision = ctrl.decide(current_demand_kw=90.0, soc=60.0, max_battery_power_kw=50.0)
        assert decision.power_kw <= 10.0 + 0.5  # Within 0.5 kW tolerance

    def test_hysteresis_stops_discharge(self):
        ctrl = PeakShavingController(demand_limit_kw=100, trigger_percent=80)
        # Start shaving
        ctrl.decide(current_demand_kw=90.0, soc=60.0, max_battery_power_kw=50.0)
        # Demand drops to below hysteresis (70% of trigger = 56kW)
        decision = ctrl.decide(current_demand_kw=55.0, soc=50.0, max_battery_power_kw=50.0)
        assert decision.action == "IDLE"


# ─── Cache Manager Tests ────────────────────────────────────────────────────

class TestCacheManager:
    def test_default_prices_available_immediately(self):
        cache = CacheManager()
        prices = cache.prices.get()
        assert isinstance(prices, dict)
        assert len(prices) == 24

    def test_update_prices(self):
        cache = CacheManager()
        new_prices = {h: 0.99 for h in range(24)}
        cache.update_prices(new_prices)
        assert cache.prices.is_fresh()
        assert cache.prices.value[0] == 0.99

    def test_cloud_setpoint_expires_after_15min(self):
        cache = CacheManager()
        cache.set_cloud_setpoint({"action": "CHARGE", "power_kw": 30})
        assert cache.is_cloud_setpoint_valid()

        # Simulate 20 minutes passing
        cache.cloud_setpoint.updated_at = cache.cloud_setpoint.updated_at.replace(
            minute=cache.cloud_setpoint.updated_at.minute
        )
        # Force it stale
        import datetime
        cache.cloud_setpoint.updated_at = (
            datetime.datetime.utcnow() - datetime.timedelta(minutes=20)
        )
        assert not cache.is_cloud_setpoint_valid()

    def test_get_cache_status(self):
        cache = CacheManager()
        status = cache.get_cache_status()
        assert "prices" in status
        assert "load_forecast" in status
        assert "cloud_setpoint" in status


# ─── Scenario Tests ─────────────────────────────────────────────────────────

class TestScenarios:
    """
    End-to-end scenario tests without real hardware.
    """

    @pytest.mark.asyncio
    async def test_scenario_normal_online_mode(self):
        """Online: edge receives cloud setpoint and executes it."""
        from src.config import load_config
        try:
            config = load_config()
        except Exception:
            pytest.skip("Config not available in test environment")

        from src.control.decision_engine import LocalDecisionEngine, EngineMode
        engine = LocalDecisionEngine(config)

        # Simulate cloud sending a setpoint
        engine.receive_cloud_command({
            "action": "CHARGE",
            "power_kw": 30.0,
            "reason": "cheap overnight rate",
        })

        assert engine.mode == EngineMode.ONLINE

        snapshot = _make_snapshot(soc=50.0)
        decision = await engine.decide(snapshot)
        assert decision["action"] == "CHARGE"
        assert decision["mode"] == "ONLINE"

    @pytest.mark.asyncio
    async def test_scenario_cloud_offline_autonomous(self):
        """Cloud offline: edge switches to AUTONOMOUS and uses cached prices."""
        from src.config import load_config
        try:
            config = load_config()
        except Exception:
            pytest.skip("Config not available in test environment")

        from src.control.decision_engine import LocalDecisionEngine, EngineMode
        engine = LocalDecisionEngine(config)

        # Simulate last cloud contact was 20 minutes ago
        engine._last_cloud_contact = time.monotonic() - (20 * 60)

        snapshot = _make_snapshot(soc=50.0)
        decision = await engine.decide(snapshot)

        assert engine.mode == EngineMode.AUTONOMOUS
        assert decision["mode"] == "AUTONOMOUS"
        # Decision should still be valid
        assert decision["action"] in ("CHARGE", "DISCHARGE", "IDLE")

    @pytest.mark.asyncio
    async def test_scenario_safe_mode(self):
        """Safe mode: only maintain SOC 20-80%, no optimization."""
        from src.config import load_config
        try:
            config = load_config()
        except Exception:
            pytest.skip("Config not available in test environment")

        from src.control.decision_engine import LocalDecisionEngine, EngineMode
        engine = LocalDecisionEngine(config)
        engine.enter_safe_mode("Test: forcing safe mode")

        assert engine.mode == EngineMode.SAFE_MODE

        # SOC too high → should discharge conservatively
        snapshot = _make_snapshot(soc=90.0)
        decision = await engine.decide(snapshot)
        assert decision["action"] == "DISCHARGE"
        assert decision["priority"] == "LONGEVITY"
        assert "[SAFE MODE]" in decision["reason"]

        # SOC too low → should charge conservatively
        snapshot = _make_snapshot(soc=10.0)
        decision = await engine.decide(snapshot)
        assert decision["action"] == "CHARGE"

        # SOC within range → should idle
        snapshot = _make_snapshot(soc=50.0)
        decision = await engine.decide(snapshot)
        assert decision["action"] == "IDLE"

    @pytest.mark.asyncio
    async def test_scenario_peak_shaving_priority_over_arbitrage(self):
        """Peak shaving (CONTRACTUAL) must win over arbitrage (ECONOMIC)."""
        from src.config import load_config
        try:
            config = load_config()
        except Exception:
            pytest.skip("Config not available in test environment")

        from src.control.decision_engine import LocalDecisionEngine
        engine = LocalDecisionEngine(config)

        # Set cheap price (would normally trigger IDLE or CHARGE by arbitrage)
        engine._arbitrage.update_price_table({h: 0.20 for h in range(24)})

        # But demand is above trigger (90kW > 80kW trigger of 100kW limit)
        # Simulate demand by making power_kw = 70 (estimated demand = 70 + 20 = 90)
        snapshot = _make_snapshot(soc=60.0, power_kw=70.0)
        decision = await engine.decide(snapshot)

        # Peak shaving should take priority
        assert decision["action"] == "DISCHARGE"
        assert decision["priority"] == "CONTRACTUAL"
