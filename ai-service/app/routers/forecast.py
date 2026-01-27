"""
Forecast Router - Load forecasting and battery optimization endpoints
"""

from fastapi import APIRouter, HTTPException, Body, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from app.services.forecast_service import forecast_service

router = APIRouter()


class LoadForecastRequest(BaseModel):
    """Load forecast request model."""
    base_load_kw: float = 10.0
    pattern_type: str = "residential"  # residential, commercial, industrial
    hours_ahead: int = 24
    start_time: Optional[str] = None


class BatteryOptimizationRequest(BaseModel):
    """Battery dispatch optimization request."""
    load_forecast: List[Dict[str, Any]]
    battery_capacity_kwh: float = 50.0
    battery_power_kw: float = 25.0
    current_soc: float = 50.0
    min_soc: float = 20.0
    max_soc: float = 95.0


class ProspectAnalysisRequest(BaseModel):
    """Prospect load analysis request."""
    power_readings: List[Dict[str, Any]]
    measurement_days: int = 7


@router.post("/load")
async def forecast_load(
    request: LoadForecastRequest = Body(...),
):
    """
    Forecast energy load for the next N hours.

    Pattern types:
    - residential: Peak evening (18:00-21:00)
    - commercial: Peak midday (09:00-17:00)
    - industrial: Flat with daytime increase
    """
    if not forecast_service.is_loaded:
        raise HTTPException(status_code=503, detail="Forecast model not loaded")

    try:
        start_time = None
        if request.start_time:
            start_time = datetime.fromisoformat(request.start_time)

        result = await forecast_service.forecast_load(
            base_load_kw=request.base_load_kw,
            pattern_type=request.pattern_type,
            hours_ahead=request.hours_ahead,
            start_time=start_time,
        )

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize")
async def optimize_battery(
    request: BatteryOptimizationRequest = Body(...),
):
    """
    Optimize battery charge/discharge schedule.

    Strategy: Peak shaving
    - Charge during off-peak hours (lower rates)
    - Discharge during peak hours (higher rates)
    - Maintain minimum SOC reserve

    Returns:
        Hourly dispatch schedule with savings estimate
    """
    if not forecast_service.is_loaded:
        raise HTTPException(status_code=503, detail="Forecast model not loaded")

    if not request.load_forecast:
        raise HTTPException(status_code=400, detail="Load forecast required")

    try:
        result = await forecast_service.optimize_battery_dispatch(
            load_forecast=request.load_forecast,
            battery_capacity_kwh=request.battery_capacity_kwh,
            battery_power_kw=request.battery_power_kw,
            current_soc=request.current_soc,
            min_soc=request.min_soc,
            max_soc=request.max_soc,
        )

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prospect/analyze")
async def analyze_prospect_load(
    request: ProspectAnalysisRequest = Body(...),
):
    """
    Analyze prospect's load data for BESS sizing.

    Input: Power readings from analyzer kit
    Output: Load analysis + BESS sizing recommendations

    Recommendations include:
    - Conservative: 50% peak coverage
    - Optimal: 100% peak coverage
    - Maximum: Full daily backup
    """
    if not forecast_service.is_loaded:
        raise HTTPException(status_code=503, detail="Forecast model not loaded")

    if not request.power_readings:
        raise HTTPException(status_code=400, detail="Power readings required")

    try:
        result = await forecast_service.analyze_prospect_load(
            power_readings=request.power_readings,
            measurement_days=request.measurement_days,
        )

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tariffs")
async def get_tariffs():
    """Get current electricity tariff structure."""
    return {
        "tariff": forecast_service.tariff,
        "description": {
            "peak_hours": "Horário de ponta",
            "peak_rate": "Tarifa ponta (R$/kWh)",
            "off_peak_rate": "Tarifa fora-ponta (R$/kWh)",
            "demand_charge": "Demanda contratada (R$/kW)",
        },
        "region": "Piauí - Equatorial",
        "updated_at": "2024-01-01",
    }


@router.get("/patterns")
async def get_load_patterns():
    """Get available load pattern templates."""
    return {
        "patterns": list(forecast_service.load_patterns.keys()),
        "description": {
            "residential": "Residencial - pico noturno (18:00-21:00)",
            "commercial": "Comercial - pico diurno (09:00-17:00)",
            "industrial": "Industrial - carga base constante",
        },
    }


@router.get("/status")
async def forecast_status():
    """Get forecast service status."""
    return {
        "service": "load_forecast",
        "loaded": forecast_service.is_loaded,
        "model_type": "pattern_based" if forecast_service.model is None else "ml_model",
    }
