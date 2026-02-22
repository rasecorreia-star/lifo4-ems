"""
LIFO4 EMS - ML Service
FastAPI microservice for machine learning: forecasting, SoH estimation, anomaly detection
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from src.api import forecast, health_api, training
from src.utils.config import settings

log = structlog.get_logger()

# Singleton trainer used by scheduler and API
from src.training.trainer import ModelTrainer
_trainer = ModelTrainer()


async def _scheduled_weekly_retraining():
    """Called by APScheduler every Monday at 02:00. Retrains all active systems."""
    model_dir = os.getenv("MODEL_DIR", "/app/models")
    system_ids: list[str] = []
    if os.path.exists(model_dir):
        system_ids = [
            d for d in os.listdir(model_dir)
            if os.path.isdir(os.path.join(model_dir, d))
        ]
    if not system_ids:
        log.info("weekly_retrain_no_systems_found")
        return
    log.info("weekly_retrain_started", systems=len(system_ids))
    for system_id in system_ids:
        try:
            job_id = await _trainer.trigger_training(system_id=system_id, force=False)
            log.info("weekly_retrain_triggered", system_id=system_id, job_id=job_id)
        except Exception as e:
            log.error("weekly_retrain_failed", system_id=system_id, error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start weekly retraining scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            _scheduled_weekly_retraining,
            trigger=CronTrigger(day_of_week="mon", hour=2, minute=0),
            id="weekly_retrain",
            name="Weekly ML model retraining",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.start()
        log.info("ml_service_startup", version="1.0.0", scheduler="active", next_run="Monday 02:00")
        app.state.scheduler = scheduler
    except ImportError:
        log.warning("apscheduler_not_available_weekly_retrain_disabled")
        log.info("ml_service_startup", version="1.0.0", scheduler="disabled")

    yield

    # Shutdown scheduler
    if hasattr(app.state, "scheduler") and app.state.scheduler.running:
        app.state.scheduler.shutdown(wait=False)
        log.info("ml_service_shutdown")


app = FastAPI(
    title="LIFO4 EMS - ML Service",
    description="Machine Learning pipeline for energy forecasting, battery health, and anomaly detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router, prefix="/api/v1/ml", tags=["forecasting"])
app.include_router(health_api.router, prefix="/api/v1/ml", tags=["battery-health"])
app.include_router(training.router, prefix="/api/v1/ml", tags=["training"])


@app.get("/health")
async def health_check():
    scheduler_status = "active" if (
        hasattr(app.state, "scheduler") and app.state.scheduler.running
    ) else "disabled"
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": "1.0.0",
        "scheduler": scheduler_status,
    }


@app.get("/metrics")
async def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi.responses import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
