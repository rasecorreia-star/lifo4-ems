"""
Training API endpoints — trigger model retraining
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import asyncio
import structlog

from src.training.trainer import ModelTrainer

log = structlog.get_logger()
router = APIRouter()

_trainer = ModelTrainer()


class TrainingRequest(BaseModel):
    force: bool = False  # Force retrain even if model is recent


class TrainingResponse(BaseModel):
    system_id: str
    status: str  # started / skipped / failed
    message: str
    job_id: Optional[str] = None


class ModelInfoResponse(BaseModel):
    system_id: str
    model_version: str
    mape: float
    rmse: float
    trained_at: str
    last_deployed_at: Optional[str]
    data_points_used: int


@router.post("/{system_id}/train", response_model=TrainingResponse)
async def trigger_training(
    system_id: str,
    request: TrainingRequest,
    authorization: str = Header(...),
):
    """Trigger manual model retraining for a system. Requires ADMIN role."""
    try:
        job_id = await _trainer.trigger_training(system_id=system_id, force=request.force)
        return TrainingResponse(
            system_id=system_id,
            status="started",
            message="Training job started in background",
            job_id=job_id,
        )
    except Exception as e:
        log.error("training_trigger_error", system_id=system_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{system_id}/model/info", response_model=ModelInfoResponse)
async def get_model_info(system_id: str):
    """Returns current model version, accuracy, and training date."""
    try:
        info = _trainer.get_model_info(system_id=system_id)
        return info
    except Exception as e:
        log.error("model_info_error", system_id=system_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/status")
async def get_all_models_status():
    """Returns status of all models across all systems."""
    try:
        status = _trainer.get_all_models_status()
        return {"models": status, "total": len(status)}
    except Exception as e:
        log.error("models_status_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
