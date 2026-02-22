"""
Battery Health API endpoints — SoH estimation and degradation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import structlog

from src.models.soh_estimator import SoHEstimator

log = structlog.get_logger()
router = APIRouter()

_soh_model = SoHEstimator()


class BatteryHealthResponse(BaseModel):
    system_id: str
    soh_percent: float
    remaining_useful_life_cycles: int
    remaining_useful_life_years: float
    degradation_rate_per_month: float
    end_of_life_date: str
    risk_level: str  # LOW / MEDIUM / HIGH / CRITICAL
    recommendations: list[str]


@router.get("/{system_id}/battery/health", response_model=BatteryHealthResponse)
async def get_battery_health(system_id: str):
    """Returns current State of Health and degradation forecast."""
    try:
        result = _soh_model.estimate(system_id=system_id)
        return result
    except Exception as e:
        log.error("battery_health_error", system_id=system_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
