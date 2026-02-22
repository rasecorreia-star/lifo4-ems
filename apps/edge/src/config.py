"""
Edge Controller configuration loader.
Merges default.yaml → site.yaml → environment variables.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


CONFIG_DIR = Path(__file__).parent.parent / "config"


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with open(path) as f:
        return yaml.safe_load(f) or {}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class BatterySpec(BaseModel):
    chemistry: str = "LiFePO4"
    capacity_kwh: float = 100.0
    nominal_voltage: float = 48.0
    cell_count: int = 16
    max_charge_power_kw: float = 50.0
    max_discharge_power_kw: float = 50.0
    max_charge_current_a: float = 200.0
    max_discharge_current_a: float = 200.0


class ModbusConfig(BaseModel):
    mode: str = "tcp"
    host: str = "192.168.1.100"
    port: int = 502
    serial_port: str = "/dev/ttyUSB0"
    baud_rate: int = 9600
    unit_id: int = 1
    timeout_ms: int = 5000
    retry_count: int = 3
    retry_delay_ms: int = 500
    register_map: str = "config/modbus-map.yaml"


class MqttConfig(BaseModel):
    broker_host: str = "localhost"
    broker_port: int = 1883
    broker_tls_port: int = 8883
    use_tls: bool = False
    client_id: str = "edge-site-001"
    keepalive_seconds: int = 60
    reconnect_min_delay: int = 1
    reconnect_max_delay: int = 120
    offline_buffer_size: int = 1000
    ca_cert: str | None = None
    client_cert: str | None = None
    client_key: str | None = None


class ControlConfig(BaseModel):
    sample_interval_seconds: int = 5
    optimization_interval_seconds: int = 300
    cloud_timeout_minutes: int = 15
    heartbeat_interval_seconds: int = 30


class DataConfig(BaseModel):
    sqlite_path: str = "/data/edge.db"
    telemetry_retention_hours: int = 72
    decisions_retention_days: int = 30
    alarms_retention_days: int = 30
    cleanup_interval_hours: int = 1


class ArbitrageConfig(BaseModel):
    buy_threshold_price: float = 0.45
    sell_threshold_price: float = 0.85
    min_soc_for_sell: float = 30.0
    max_soc_for_buy: float = 90.0


class PeakShavingConfig(BaseModel):
    demand_limit_kw: float = 100.0
    trigger_percent: float = 80.0
    min_soc_percent: float = 20.0
    ramp_rate_kw_per_sec: float = 10.0
    recharge_start_hour: int = 22
    recharge_end_hour: int = 6


class SolarConfig(BaseModel):
    min_solar_excess_kw: float = 1.0
    target_soc: float = 80.0
    night_discharge: bool = True


class SafeModeConfig(BaseModel):
    min_soc: float = 20.0
    max_soc: float = 80.0


class OptimizationConfig(BaseModel):
    arbitrage: ArbitrageConfig = Field(default_factory=ArbitrageConfig)
    peak_shaving: PeakShavingConfig = Field(default_factory=PeakShavingConfig)
    solar: SolarConfig = Field(default_factory=SolarConfig)
    safe_mode: SafeModeConfig = Field(default_factory=SafeModeConfig)


class SiteConfig(BaseModel):
    id: str = "site-001"
    name: str = "LIFO4 Site"
    organization_id: str = "org-001"


class EdgeConfig(BaseModel):
    site: SiteConfig = Field(default_factory=SiteConfig)
    battery: BatterySpec = Field(default_factory=BatterySpec)
    modbus: ModbusConfig = Field(default_factory=ModbusConfig)
    mqtt: MqttConfig = Field(default_factory=MqttConfig)
    control: ControlConfig = Field(default_factory=ControlConfig)
    data: DataConfig = Field(default_factory=DataConfig)
    optimization: OptimizationConfig = Field(default_factory=OptimizationConfig)


def load_config() -> EdgeConfig:
    """Load and merge configuration from YAML files."""
    defaults = _load_yaml(CONFIG_DIR / "default.yaml")
    site_overrides = _load_yaml(CONFIG_DIR / "site.yaml")
    merged = _deep_merge(defaults, site_overrides)

    # Allow env var overrides for critical settings
    if broker := os.getenv("MQTT_BROKER_HOST"):
        merged.setdefault("mqtt", {})["broker_host"] = broker
    if site_id := os.getenv("SITE_ID"):
        merged.setdefault("site", {})["id"] = site_id
    if db_path := os.getenv("SQLITE_PATH"):
        merged.setdefault("data", {})["sqlite_path"] = db_path

    return EdgeConfig.model_validate(merged)
