"""
Configuration for Lifo4 EMS AI Service
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Lifo4 EMS AI Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    workers: int = 1

    # Backend API
    backend_url: str = "http://localhost:3001"
    backend_api_key: Optional[str] = None

    # Redis
    redis_url: str = "redis://localhost:6379/1"

    # Database
    database_url: Optional[str] = None

    # YOLOv8 settings
    yolo_model: str = "yolov8n.pt"  # nano model for speed
    yolo_confidence: float = 0.5
    yolo_iou_threshold: float = 0.45

    # Whisper settings
    whisper_model: str = "base"  # tiny, base, small, medium, large
    whisper_language: str = "pt"  # Portuguese

    # Processing settings
    max_image_size: int = 1920
    max_video_duration: int = 60  # seconds
    max_audio_duration: int = 30  # seconds

    # Model paths
    models_dir: str = "./models"
    anomaly_model_path: str = "./models/battery_anomaly.pkl"
    forecast_model_path: str = "./models/load_forecast.pkl"

    # GPU settings
    use_gpu: bool = True
    gpu_device: int = 0

    class Config:
        env_file = ".env"
        env_prefix = "AI_"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
