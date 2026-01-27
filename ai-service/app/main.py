"""
Lifo4 EMS AI Service - FastAPI Application
Person detection (YOLOv8), voice analysis (Whisper), battery anomaly detection
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from app.config import settings
from app.routers import detection, audio, anomaly, forecast
from app.routers import digital_twin
from app.routers import protocol
from app.routers import self_optimization
from app.routers import agents
from app.routers import nlp
from app.routers import config_learning
from app.services.yolo_service import yolo_service
from app.services.whisper_service import whisper_service
from app.services.anomaly_service import anomaly_service
from app.services.forecast_service import forecast_service
from app.services.digital_twin import pybamm_simulator, state_estimator, degradation_predictor

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # Load ML models
    logger.info("Loading YOLOv8 model...")
    await yolo_service.load_model()

    logger.info("Loading Whisper model...")
    await whisper_service.load_model()

    logger.info("Loading anomaly detection model...")
    await anomaly_service.load_model()

    logger.info("Loading forecast model...")
    await forecast_service.load_model()

    logger.info("Loading digital twin services...")
    await pybamm_simulator.load_model()
    await state_estimator.load_model()
    await degradation_predictor.load_model()

    logger.info("All models loaded successfully!")

    yield

    # Shutdown
    logger.info("Shutting down AI service...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI/ML service for Lifo4 EMS - Person detection, voice analysis, battery analytics",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include routers
app.include_router(detection.router, prefix="/api/v1/detection", tags=["Detection"])
app.include_router(audio.router, prefix="/api/v1/audio", tags=["Audio"])
app.include_router(anomaly.router, prefix="/api/v1/anomaly", tags=["Anomaly"])
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["Forecast"])
app.include_router(digital_twin.router, prefix="/api/v1/digital-twin", tags=["Digital Twin"])
app.include_router(protocol.router, prefix="/api/v1", tags=["Protocol Detection"])
app.include_router(self_optimization.router, prefix="/api/v1", tags=["Self-Optimization"])
app.include_router(agents.router, prefix="/api/v1", tags=["Multi-Agent System"])
app.include_router(nlp.router, prefix="/api/v1", tags=["Virtual Assistant"])
app.include_router(config_learning.router, prefix="/api/v1", tags=["Config Learning"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "models": {
            "yolo": yolo_service.is_loaded,
            "whisper": whisper_service.is_loaded,
            "anomaly": anomaly_service.is_loaded,
            "forecast": forecast_service.is_loaded,
            "digital_twin": pybamm_simulator.is_loaded,
            "state_estimator": state_estimator.is_loaded,
            "degradation_predictor": degradation_predictor.is_loaded,
        }
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "endpoints": {
            "detection": "/api/v1/detection",
            "audio": "/api/v1/audio",
            "anomaly": "/api/v1/anomaly",
            "forecast": "/api/v1/forecast",
            "digital_twin": "/api/v1/digital-twin",
            "protocol": "/api/v1/protocol",
            "self_optimization": "/api/v1/self-optimization",
            "agents": "/api/v1/agents",
            "nlp": "/api/v1/nlp",
            "config_learning": "/api/v1/config-learning",
            "metrics": "/metrics",
            "health": "/health",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=settings.workers,
    )
