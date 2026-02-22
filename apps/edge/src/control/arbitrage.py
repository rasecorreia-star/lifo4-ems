"""
Offline arbitrage algorithm.
Buys cheap energy (off-peak) and sells expensive energy (peak).
Works 100% offline using a cached hourly price table.
If cache expires (>48h), falls back to ANEEL standard peak schedule.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ANEEL standard peak hours (Brazil): 18h-21h (Mon-Sat)
ANEEL_PEAK_HOURS = {18, 19, 20}
ANEEL_PEAK_DAYS = {0, 1, 2, 3, 4, 5}  # Monday=0 to Saturday=5

# Default price table (R$/kWh) — ANEEL-inspired, used when cloud is offline
DEFAULT_PRICE_TABLE: dict[int, float] = {
    0: 0.32, 1: 0.30, 2: 0.29, 3: 0.28, 4: 0.28, 5: 0.30,
    6: 0.35, 7: 0.42, 8: 0.55, 9: 0.60, 10: 0.62, 11: 0.65,
    12: 0.63, 13: 0.60, 14: 0.58, 15: 0.57, 16: 0.60, 17: 0.72,
    18: 0.95, 19: 0.92, 20: 0.88, 21: 0.75, 22: 0.55, 23: 0.40,
}


@dataclass
class ArbitrageDecision:
    action: str          # "CHARGE", "DISCHARGE", "IDLE"
    power_kw: float
    reason: str
    price: float


class ArbitrageController:
    """
    Price-based energy arbitrage.
    Uses cached hourly price table from cloud.
    Falls back to ANEEL schedule when cloud is unavailable >48h.
    """

    def __init__(
        self,
        buy_threshold: float = 0.45,     # R$/kWh — charge if below
        sell_threshold: float = 0.85,    # R$/kWh — discharge if above
        min_soc_for_sell: float = 30.0,  # % — don't discharge below this
        max_soc_for_buy: float = 90.0,   # % — don't charge above this
        max_charge_power_kw: float = 50.0,
        max_discharge_power_kw: float = 50.0,
    ):
        self._buy_threshold = buy_threshold
        self._sell_threshold = sell_threshold
        self._min_soc_for_sell = min_soc_for_sell
        self._max_soc_for_buy = max_soc_for_buy
        self._max_charge_kw = max_charge_power_kw
        self._max_discharge_kw = max_discharge_power_kw
        self._cached_prices: dict[int, float] = DEFAULT_PRICE_TABLE.copy()
        self._cache_updated_at: Optional[datetime] = None
        self._cache_is_default = True

    def update_price_table(self, prices: dict[int, float]) -> None:
        """Update from cloud. Keys are hours 0-23, values are R$/kWh."""
        if len(prices) < 12:
            logger.warning("arbitrage_price_table_too_small", received=len(prices))
            return
        self._cached_prices = prices
        self._cache_updated_at = datetime.utcnow()
        self._cache_is_default = False
        logger.info("arbitrage_price_table_updated", prices=prices)

    def _current_price(self) -> float:
        """Get price for the current hour."""
        hour = datetime.now().hour
        return self._cached_prices.get(hour, DEFAULT_PRICE_TABLE.get(hour, 0.5))

    def _cache_age_hours(self) -> float:
        if not self._cache_updated_at:
            return float('inf')
        delta = datetime.utcnow() - self._cache_updated_at
        return delta.total_seconds() / 3600.0

    def _using_stale_cache(self) -> bool:
        return self._cache_age_hours() > 48.0

    def decide(self, soc: float, max_power_kw: float) -> ArbitrageDecision:
        """
        Make arbitrage decision based on current price and SOC.
        Priority: ECONOMIC (runs after SAFETY, GRID_CODE, CONTRACTUAL).
        """
        price = self._current_price()
        cache_note = " [stale cache]" if self._using_stale_cache() else ""
        cache_note += " [default table]" if self._cache_is_default else ""

        charge_power = min(self._max_charge_kw, max_power_kw)
        discharge_power = min(self._max_discharge_kw, max_power_kw)

        # Case 1: Cheap energy — charge if SOC is below max
        if price < self._buy_threshold and soc < self._max_soc_for_buy:
            # Charge harder when price is especially cheap
            price_factor = 1.0 - (price / self._buy_threshold)
            power = charge_power * max(0.5, price_factor)
            return ArbitrageDecision(
                action="CHARGE",
                power_kw=round(power, 1),
                reason=f"Cheap price {price:.2f} R$/kWh < {self._buy_threshold} (buy threshold){cache_note}",
                price=price,
            )

        # Case 2: Expensive energy — discharge if SOC is above min
        if price > self._sell_threshold and soc > self._min_soc_for_sell:
            # Discharge harder when price is especially high
            price_factor = (price - self._sell_threshold) / self._sell_threshold
            power = discharge_power * min(1.0, 0.5 + price_factor)
            return ArbitrageDecision(
                action="DISCHARGE",
                power_kw=round(power, 1),
                reason=f"High price {price:.2f} R$/kWh > {self._sell_threshold} (sell threshold){cache_note}",
                price=price,
            )

        # Case 3: Mid-range price — do nothing
        return ArbitrageDecision(
            action="IDLE",
            power_kw=0.0,
            reason=f"Price {price:.2f} R$/kWh in neutral zone [{self._buy_threshold}, {self._sell_threshold}]{cache_note}",
            price=price,
        )
