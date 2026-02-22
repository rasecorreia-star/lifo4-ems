"""
Cache manager for the edge controller.
Stores prices, forecasts, configs received from cloud.
Each item has TTL and fallback value.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Generic, Optional, TypeVar

from src.utils.logger import get_logger

logger = get_logger(__name__)

T = TypeVar("T")

# Default ANEEL price table (R$/kWh) — used when cloud offline >48h
DEFAULT_PRICES: dict[int, float] = {
    0: 0.32, 1: 0.30, 2: 0.29, 3: 0.28, 4: 0.28, 5: 0.30,
    6: 0.35, 7: 0.42, 8: 0.55, 9: 0.60, 10: 0.62, 11: 0.65,
    12: 0.63, 13: 0.60, 14: 0.58, 15: 0.57, 16: 0.60, 17: 0.72,
    18: 0.95, 19: 0.92, 20: 0.88, 21: 0.75, 22: 0.55, 23: 0.40,
}

DEFAULT_OPTIMIZATION_CONFIG = {
    "arbitrage": {
        "buy_threshold_price": 0.45,
        "sell_threshold_price": 0.85,
        "min_soc_for_sell": 30,
        "max_soc_for_buy": 90,
    },
    "peak_shaving": {
        "demand_limit_kw": 100,
        "trigger_percent": 80,
        "min_soc_percent": 20,
    },
    "solar": {
        "min_solar_excess_kw": 1,
        "target_soc": 80,
        "night_discharge": True,
    },
}


@dataclass
class CacheEntry(Generic[T]):
    value: T
    updated_at: Optional[datetime] = None
    ttl_hours: float = 48.0
    fallback: Optional[T] = None

    def is_fresh(self) -> bool:
        if self.updated_at is None:
            return False
        age = datetime.utcnow() - self.updated_at
        return age < timedelta(hours=self.ttl_hours)

    def is_stale(self) -> bool:
        return not self.is_fresh()

    def age_hours(self) -> float:
        if self.updated_at is None:
            return float("inf")
        return (datetime.utcnow() - self.updated_at).total_seconds() / 3600.0

    def get(self) -> T:
        """Get current value. Returns fallback if stale."""
        if self.is_stale() and self.fallback is not None:
            return self.fallback
        return self.value

    def update(self, value: T) -> None:
        self.value = value
        self.updated_at = datetime.utcnow()


class CacheManager:
    """
    Central cache for all cloud-provided data.
    The edge controller is still functional if any/all caches expire.
    """

    def __init__(self):
        self.prices: CacheEntry[dict[int, float]] = CacheEntry(
            value=DEFAULT_PRICES.copy(),
            fallback=DEFAULT_PRICES.copy(),
            ttl_hours=48.0,
        )

        self.load_forecast: CacheEntry[list[float]] = CacheEntry(
            value=[50.0] * 24,           # Default: 50kW flat load
            fallback=[50.0] * 24,
            ttl_hours=14 * 24.0,         # 14 days
        )

        self.solar_forecast: CacheEntry[list[float]] = CacheEntry(
            value=[0.0] * 24,            # Default: no solar (conservative)
            fallback=[0.0] * 24,
            ttl_hours=24.0,
        )

        self.optimization_config: CacheEntry[dict] = CacheEntry(
            value=DEFAULT_OPTIMIZATION_CONFIG.copy(),
            fallback=DEFAULT_OPTIMIZATION_CONFIG.copy(),
            ttl_hours=float("inf"),      # Config is retained until replaced
        )

        self.cloud_setpoint: CacheEntry[Optional[dict]] = CacheEntry(
            value=None,
            fallback=None,
            ttl_hours=0.25,             # 15 minutes — setpoints expire quickly
        )

    def update_prices(self, prices: dict[int, float]) -> None:
        self.prices.update(prices)
        logger.info("cache_prices_updated", hours_count=len(prices))

    def update_load_forecast(self, forecast_24h: list[float]) -> None:
        self.load_forecast.update(forecast_24h)
        logger.info("cache_load_forecast_updated")

    def update_solar_forecast(self, forecast_24h: list[float]) -> None:
        self.solar_forecast.update(forecast_24h)
        logger.info("cache_solar_forecast_updated")

    def update_optimization_config(self, config: dict) -> None:
        self.optimization_config.update(config)
        logger.info("cache_config_updated")

    def set_cloud_setpoint(self, setpoint: dict) -> None:
        self.cloud_setpoint.update(setpoint)
        logger.info("cache_cloud_setpoint_received", setpoint=setpoint)

    def is_cloud_setpoint_valid(self) -> bool:
        return (
            self.cloud_setpoint.value is not None
            and self.cloud_setpoint.is_fresh()
        )

    def get_cache_status(self) -> dict:
        return {
            "prices": {
                "fresh": self.prices.is_fresh(),
                "age_hours": round(self.prices.age_hours(), 1),
                "using_default": self.prices.updated_at is None,
            },
            "load_forecast": {
                "fresh": self.load_forecast.is_fresh(),
                "age_hours": round(self.load_forecast.age_hours(), 1),
            },
            "solar_forecast": {
                "fresh": self.solar_forecast.is_fresh(),
                "age_hours": round(self.solar_forecast.age_hours(), 1),
            },
            "optimization_config": {
                "fresh": self.optimization_config.is_fresh(),
            },
            "cloud_setpoint": {
                "valid": self.is_cloud_setpoint_valid(),
                "age_minutes": round(self.cloud_setpoint.age_hours() * 60, 1),
            },
        }
