"""
Forecast API endpoints — load and price forecasting
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import numpy as np
import structlog

from src.models.load_forecast import LoadForecastModel
from src.models.price_forecast import PriceForecastModel
from src.models.anomaly_detector import AnomalyDetector

log = structlog.get_logger()
router = APIRouter()

_load_model = LoadForecastModel()
_price_model = PriceForecastModel()
_anomaly_model = AnomalyDetector()


class ForecastResponse(BaseModel):
    system_id: str
    horizon_hours: int
    predictions: list[dict]
    model_version: str
    mape: float
    generated_at: str


@router.get("/{system_id}/forecast/load", response_model=ForecastResponse)
async def get_load_forecast(
    system_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Returns load forecast for the next N hours."""
    try:
        result = _load_model.predict(system_id=system_id, horizon_hours=hours)
        return result
    except Exception as e:
        log.error("load_forecast_error", system_id=system_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{system_id}/forecast/price", response_model=ForecastResponse)
async def get_price_forecast(
    system_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Returns electricity price forecast for the next N hours."""
    try:
        result = _price_model.predict(system_id=system_id, horizon_hours=hours)
        return result
    except Exception as e:
        log.error("price_forecast_error", system_id=system_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{system_id}/anomalies")
async def get_anomalies(
    system_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Returns detected anomalies in the last N hours."""
    try:
        anomalies = _anomaly_model.detect(system_id=system_id, lookback_hours=hours)
        return {
            "system_id": system_id,
            "lookback_hours": hours,
            "anomalies": anomalies,
            "total": len(anomalies),
        }
    except Exception as e:
        log.error("anomaly_detection_error", system_id=system_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
