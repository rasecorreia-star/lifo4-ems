"""
Anomaly Detection Router - Battery diagnostics endpoints
"""

from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from pydantic import BaseModel

from app.services.anomaly_service import anomaly_service

router = APIRouter()


class TelemetryData(BaseModel):
    """Battery telemetry data model."""
    soc: float = 50
    soh: float = 100
    totalVoltage: float = 51.2
    current: float = 0
    power: float = 0
    cycleCount: int = 0
    temperature: Dict[str, float] = {"min": 25, "max": 30, "average": 27}
    cells: List[Dict[str, Any]] = []


class TelemetryHistory(BaseModel):
    """Historical telemetry data."""
    history: List[TelemetryData]


@router.post("/analyze")
async def analyze_telemetry(
    telemetry: TelemetryData = Body(...),
):
    """
    Analyze battery telemetry for anomalies.

    Checks for:
    - Cell overvoltage/undervoltage
    - Cell imbalance
    - Temperature anomalies
    - SOH degradation
    - Current limits

    Returns:
        Health score (0-100) and list of anomalies/warnings
    """
    if not anomaly_service.is_loaded:
        raise HTTPException(status_code=503, detail="Anomaly model not loaded")

    try:
        result = await anomaly_service.analyze_telemetry(telemetry.model_dump())

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
async def analyze_history(
    data: TelemetryHistory = Body(...),
):
    """
    Analyze telemetry history for trends.

    Calculates:
    - SOH degradation rate
    - Estimated remaining cycles
    - End-of-life prediction
    - Maintenance recommendations
    """
    if not anomaly_service.is_loaded:
        raise HTTPException(status_code=503, detail="Anomaly model not loaded")

    if not data.history:
        raise HTTPException(status_code=400, detail="No history data provided")

    try:
        history = [t.model_dump() for t in data.history]
        result = await anomaly_service.analyze_history(history)

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def analyze_batch(
    systems: List[Dict[str, Any]] = Body(...),
):
    """
    Analyze multiple systems at once.

    Input format:
    [
        {"systemId": "sys1", "telemetry": {...}},
        {"systemId": "sys2", "telemetry": {...}},
    ]
    """
    if not anomaly_service.is_loaded:
        raise HTTPException(status_code=503, detail="Anomaly model not loaded")

    try:
        results = []
        for system in systems:
            system_id = system.get("systemId")
            telemetry = system.get("telemetry", {})

            analysis = await anomaly_service.analyze_telemetry(telemetry)
            results.append({
                "systemId": system_id,
                "analysis": analysis,
            })

        # Summary
        critical_count = sum(1 for r in results if r["analysis"]["status"] == "critical")
        warning_count = sum(1 for r in results if r["analysis"]["status"] == "warning")
        healthy_count = sum(1 for r in results if r["analysis"]["status"] == "healthy")

        return JSONResponse(content={
            "success": True,
            "data": {
                "results": results,
                "summary": {
                    "total": len(results),
                    "critical": critical_count,
                    "warning": warning_count,
                    "healthy": healthy_count,
                },
            },
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thresholds")
async def get_thresholds():
    """Get current anomaly detection thresholds."""
    return {
        "thresholds": anomaly_service.thresholds,
        "description": {
            "cell_overvoltage": "Tensão máxima por célula (V)",
            "cell_undervoltage": "Tensão mínima por célula (V)",
            "cell_imbalance_max": "Desbalanceamento máximo (V)",
            "temp_high_critical": "Temperatura crítica alta (°C)",
            "temp_low_critical": "Temperatura crítica baixa (°C)",
            "soh_degraded": "SOH considerado degradado (%)",
            "soh_critical": "SOH crítico (%)",
        },
    }


@router.get("/status")
async def anomaly_status():
    """Get anomaly detection service status."""
    return {
        "service": "anomaly_detection",
        "loaded": anomaly_service.is_loaded,
        "model_type": "rule_based" if anomaly_service.model is None else "ml_model",
    }
