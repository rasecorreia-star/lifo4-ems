"""
ML Service Configuration -- environment-driven settings.
"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mqtt_url: str = os.getenv("MQTT_URL", "mqtt://mosquitto:1883")
    influx_url: str = os.getenv("INFLUX_URL", "http://influxdb:8086")
    influx_token: str = os.getenv("INFLUX_TOKEN", "")
    influx_org: str = os.getenv("INFLUX_ORG", "lifo4")
    influx_bucket: str = os.getenv("INFLUX_BUCKET", "bess_telemetry")
    model_dir: str = os.getenv("MODEL_DIR", "/app/models")
    retrain_cron: str = "0 3 * * 0"  # Sunday 03:00 UTC
    mape_threshold: float = 5.0  # retrain if MAPE exceeds this
    min_data_days: int = 30  # minimum days of data to start training
    log_level: str = os.getenv("LOG_LEVEL", "info")

    class Config:
        env_file = ".env"


settings = Settings()
