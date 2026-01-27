"""
Lifo4 EMS - Raspberry Pi Edge Gateway Configuration
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Edge gateway configuration."""

    # Device identification
    device_id: str = "rpi-gateway-001"
    site_id: str = "site-001"
    organization_id: str = "org-001"

    # Local API server
    api_host: str = "0.0.0.0"
    api_port: int = 8080

    # MQTT configuration
    mqtt_broker: str = "mqtt.lifo4.com.br"
    mqtt_port: int = 1883
    mqtt_username: str = "device"
    mqtt_password: str = "device-password"
    mqtt_keepalive: int = 60
    mqtt_qos: int = 1

    # Cloud API
    cloud_api_url: str = "https://api.lifo4.com.br"
    cloud_api_key: Optional[str] = None

    # Local database
    database_path: str = "./data/edge.db"
    data_retention_days: int = 7

    # Modbus configuration
    modbus_enabled: bool = True
    modbus_port: str = "/dev/ttyUSB0"
    modbus_baudrate: int = 9600
    modbus_timeout: float = 1.0

    # CAN bus configuration
    can_enabled: bool = False
    can_interface: str = "can0"
    can_bitrate: int = 250000

    # Connected devices
    bms_devices: List[str] = []
    inverter_devices: List[str] = []
    meter_devices: List[str] = []

    # Polling intervals (milliseconds)
    telemetry_interval: int = 5000
    status_interval: int = 60000
    sync_interval: int = 30000  # Cloud sync

    # Buffer settings
    offline_buffer_size: int = 10000
    sync_batch_size: int = 100

    # Features
    local_dashboard: bool = True
    data_logging: bool = True
    alert_forwarding: bool = True

    class Config:
        env_file = ".env"
        env_prefix = "EDGE_"


settings = Settings()
