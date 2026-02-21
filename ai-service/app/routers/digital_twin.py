"""
Digital Twin API Router
Endpoints for battery simulation, state estimation, and degradation prediction
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from app.services.digital_twin import (
    pybamm_simulator,
    BatteryModelFactory,
    state_estimator,
    degradation_predictor,
)
from app.services.digital_twin.pybamm_simulator import SimulationConfig, SimulationResult
from app.services.digital_twin.degradation_predictor import DegradationFactors

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================
# Request/Response Models
# ============================================

class SimulationRequest(BaseModel):
    """Request model for battery simulation"""
    nominal_capacity: float = Field(default=100.0, description="Nominal capacity in Ah")
    nominal_voltage: float = Field(default=51.2, description="Nominal voltage in V")
    cells_in_series: int = Field(default=16, description="Number of cells in series")
    cells_in_parallel: int = Field(default=1, description="Number of cells in parallel")
    initial_soc: float = Field(default=0.5, ge=0, le=1, description="Initial SOC (0-1)")
    temperature: float = Field(default=25.0, description="Ambient temperature in Celsius")
    c_rate: float = Field(default=0.5, description="C-rate for charge/discharge")
    simulation_time: float = Field(default=3600.0, description="Simulation time in seconds")
    time_step: float = Field(default=60.0, description="Time step in seconds")
    current_profile: Optional[List[Dict[str, float]]] = Field(
        default=None,
        description="Custom current profile as [{time: float, current: float}]"
    )


class CyclePredictionRequest(BaseModel):
    """Request model for cycle prediction"""
    current_soh: float = Field(..., ge=0, le=1, description="Current SOH (0-1)")
    avg_dod: float = Field(default=0.8, ge=0, le=1, description="Average DOD")
    avg_c_rate: float = Field(default=0.5, ge=0, description="Average C-rate")
    avg_temperature: float = Field(default=25.0, description="Average temperature")
    cycles_per_day: float = Field(default=1.0, ge=0, description="Cycles per day")


class ComparisonRequest(BaseModel):
    """Request model for simulation vs real data comparison"""
    simulation_config: SimulationRequest
    real_data: Dict[str, List[float]] = Field(
        ...,
        description="Real telemetry data with time, voltage, current, soc arrays"
    )


class StateUpdateRequest(BaseModel):
    """Request model for state estimator update"""
    voltage: float = Field(..., description="Terminal voltage in V")
    current: float = Field(..., description="Current in A (positive = discharge)")
    temperature: Optional[float] = Field(default=None, description="Temperature in Celsius")
    dt: float = Field(default=1.0, description="Time step in seconds")


class TelemetryBatchRequest(BaseModel):
    """Request model for batch telemetry processing"""
    telemetry: List[Dict[str, Any]] = Field(
        ...,
        description="List of telemetry readings with timestamp, voltage, current"
    )


class DegradationRequest(BaseModel):
    """Request model for degradation prediction"""
    avg_dod: float = Field(default=0.8, ge=0, le=1)
    avg_c_rate_charge: float = Field(default=0.5, ge=0)
    avg_c_rate_discharge: float = Field(default=0.5, ge=0)
    avg_temperature: float = Field(default=25.0)
    max_temperature: float = Field(default=35.0)
    min_temperature: float = Field(default=15.0)
    time_at_high_soc: float = Field(default=0.1, ge=0, le=1)
    time_at_low_soc: float = Field(default=0.1, ge=0, le=1)
    calendar_days: int = Field(default=0, ge=0)
    cycle_count: float = Field(default=0, ge=0)


class BatteryModelRequest(BaseModel):
    """Request model for creating a battery model"""
    model_id: str = Field(..., description="Unique identifier")
    name: str = Field(..., description="Human-readable name")
    cell_type: str = Field(default="eve_lf280k", description="Cell type from library")
    pack_type: str = Field(default="48v_5kwh", description="Pack configuration from library")


# ============================================
# Simulation Endpoints
# ============================================

@router.post("/simulate", response_model=Dict[str, Any])
async def run_simulation(request: SimulationRequest):
    """
    Run a battery simulation

    Simulates battery behavior over time using physics-based models.
    Returns time-series data for voltage, current, SOC, temperature, and power.
    """
    try:
        if not pybamm_simulator.is_loaded:
            await pybamm_simulator.load_model()

        config = SimulationConfig(
            nominal_capacity=request.nominal_capacity,
            nominal_voltage=request.nominal_voltage,
            cells_in_series=request.cells_in_series,
            cells_in_parallel=request.cells_in_parallel,
            initial_soc=request.initial_soc,
            temperature=request.temperature,
            c_rate=request.c_rate,
            simulation_time=request.simulation_time,
            time_step=request.time_step,
        )

        result = await pybamm_simulator.simulate(config, request.current_profile)

        return {
            "success": True,
            "simulation": {
                "time": result.time,
                "voltage": result.voltage,
                "current": result.current,
                "soc": result.soc,
                "temperature": result.temperature,
                "power": result.power,
                "internal_resistance": result.internal_resistance,
            },
            "metadata": result.metadata,
            "summary": {
                "duration_hours": result.time[-1] / 3600 if result.time else 0,
                "final_soc": result.soc[-1] if result.soc else 0,
                "max_power_kw": max(abs(p) for p in result.power) / 1000 if result.power else 0,
                "avg_temperature": sum(result.temperature) / len(result.temperature) if result.temperature else 0,
            }
        }

    except Exception as e:
        logger.error(f"Simulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict-cycles", response_model=Dict[str, Any])
async def predict_cycles(request: CyclePredictionRequest):
    """
    Predict remaining battery cycles

    Based on current SOH and usage patterns, predicts remaining useful life
    in terms of cycles, time, and expected EOL date.
    """
    try:
        if not pybamm_simulator.is_loaded:
            await pybamm_simulator.load_model()

        result = await pybamm_simulator.predict_cycles_remaining(
            current_soh=request.current_soh,
            usage_pattern={
                "avg_dod": request.avg_dod,
                "avg_c_rate": request.avg_c_rate,
                "avg_temperature": request.avg_temperature,
                "cycles_per_day": request.cycles_per_day,
            }
        )

        return {
            "success": True,
            "prediction": result,
        }

    except Exception as e:
        logger.error(f"Cycle prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare", response_model=Dict[str, Any])
async def compare_simulation_with_real(request: ComparisonRequest):
    """
    Compare simulation with real telemetry data

    Validates the digital twin accuracy by comparing simulated results
    with actual measurements. Returns error metrics and correlation.
    """
    try:
        if not pybamm_simulator.is_loaded:
            await pybamm_simulator.load_model()

        # Run simulation
        config = SimulationConfig(
            nominal_capacity=request.simulation_config.nominal_capacity,
            nominal_voltage=request.simulation_config.nominal_voltage,
            cells_in_series=request.simulation_config.cells_in_series,
            cells_in_parallel=request.simulation_config.cells_in_parallel,
            initial_soc=request.simulation_config.initial_soc,
            temperature=request.simulation_config.temperature,
            c_rate=request.simulation_config.c_rate,
            simulation_time=request.simulation_config.simulation_time,
            time_step=request.simulation_config.time_step,
        )

        sim_result = await pybamm_simulator.simulate(config)

        # Compare with real data
        comparison = await pybamm_simulator.compare_with_real_data(
            sim_result,
            request.real_data
        )

        return {
            "success": True,
            "comparison": comparison,
            "model_accuracy_percent": comparison["overall_accuracy"] * 100,
            "model_validated": comparison["model_valid"],
        }

    except Exception as e:
        logger.error(f"Comparison failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# State Estimation Endpoints
# ============================================

@router.post("/state/update", response_model=Dict[str, Any])
async def update_state(request: StateUpdateRequest):
    """
    Update state estimate with new measurement

    Uses Extended Kalman Filter to estimate SOC, SOH, and power limits
    from voltage and current measurements.
    """
    try:
        if not state_estimator.is_loaded:
            await state_estimator.load_model()

        state = await state_estimator.update(
            voltage=request.voltage,
            current=request.current,
            temperature=request.temperature,
            dt=request.dt,
        )

        return {
            "success": True,
            "state": state_estimator.to_dict(state),
        }

    except Exception as e:
        logger.error(f"State update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/current", response_model=Dict[str, Any])
async def get_current_state():
    """
    Get current estimated state

    Returns the most recent state estimate including SOC, SOH,
    power limits, and confidence level.
    """
    try:
        state = await state_estimator.get_current_state()

        if state is None:
            return {
                "success": True,
                "state": None,
                "message": "No state data available. Send measurements first.",
            }

        return {
            "success": True,
            "state": state_estimator.to_dict(state),
        }

    except Exception as e:
        logger.error(f"Get state failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/state/batch", response_model=Dict[str, Any])
async def process_telemetry_batch(request: TelemetryBatchRequest):
    """
    Process batch telemetry data

    Processes multiple telemetry readings to estimate current state.
    Useful for catch-up processing after communication gaps.
    """
    try:
        if not state_estimator.is_loaded:
            await state_estimator.load_model()

        state = await state_estimator.estimate_from_telemetry(request.telemetry)

        return {
            "success": True,
            "state": state_estimator.to_dict(state) if state else None,
            "points_processed": len(request.telemetry),
        }

    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/state/calibrate", response_model=Dict[str, Any])
async def calibrate_estimator(
    actual_soc: float = Query(..., ge=0, le=1, description="Actual SOC"),
    actual_capacity: Optional[float] = Query(None, description="Actual capacity in Ah"),
):
    """
    Calibrate the state estimator

    Use after a full charge (SOC=1) or capacity test to improve accuracy.
    """
    try:
        await state_estimator.calibrate(actual_soc, actual_capacity)

        return {
            "success": True,
            "message": f"Estimator calibrated with SOC={actual_soc}",
        }

    except Exception as e:
        logger.error(f"Calibration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Degradation Prediction Endpoints
# ============================================

@router.post("/degradation/predict", response_model=Dict[str, Any])
async def predict_degradation(request: DegradationRequest):
    """
    Predict battery degradation

    Uses physics-based and ML models to predict current and future SOH,
    remaining life, and provides recommendations for extending battery life.
    """
    try:
        if not degradation_predictor.is_loaded:
            await degradation_predictor.load_model()

        factors = DegradationFactors(
            avg_dod=request.avg_dod,
            avg_c_rate_charge=request.avg_c_rate_charge,
            avg_c_rate_discharge=request.avg_c_rate_discharge,
            avg_temperature=request.avg_temperature,
            max_temperature=request.max_temperature,
            min_temperature=request.min_temperature,
            time_at_high_soc=request.time_at_high_soc,
            time_at_low_soc=request.time_at_low_soc,
            calendar_days=request.calendar_days,
            cycle_count=request.cycle_count,
        )

        prediction = await degradation_predictor.predict(factors)

        return {
            "success": True,
            "prediction": degradation_predictor.to_dict(prediction),
        }

    except Exception as e:
        logger.error(f"Degradation prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/degradation/trajectory", response_model=Dict[str, Any])
async def get_degradation_trajectory(
    request: DegradationRequest,
    years: int = Query(default=10, ge=1, le=20, description="Years to project"),
):
    """
    Get predicted degradation trajectory

    Returns projected SOH values over time for visualization.
    """
    try:
        if not degradation_predictor.is_loaded:
            await degradation_predictor.load_model()

        factors = DegradationFactors(**request.dict())

        trajectory = await degradation_predictor.get_degradation_trajectory(
            factors,
            years=years,
        )

        return {
            "success": True,
            "trajectory": trajectory,
        }

    except Exception as e:
        logger.error(f"Trajectory prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/degradation/record", response_model=Dict[str, Any])
async def record_soh_measurement(
    request: DegradationRequest,
    measured_soh: float = Query(..., ge=0, le=1, description="Measured SOH"),
):
    """
    Record a SOH measurement for ML training

    Improves degradation prediction accuracy over time by learning
    from actual measurements.
    """
    try:
        if not degradation_predictor.is_loaded:
            await degradation_predictor.load_model()

        factors = DegradationFactors(**request.dict())
        await degradation_predictor.record_measurement(factors, measured_soh)

        return {
            "success": True,
            "message": "Measurement recorded",
        }

    except Exception as e:
        logger.error(f"Recording failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Battery Model Library Endpoints
# ============================================

@router.get("/models/cells", response_model=Dict[str, Any])
async def list_cell_types():
    """List available cell types in the library"""
    return {
        "success": True,
        "cells": BatteryModelFactory.list_available_cells(),
        "details": {
            cell: BatteryModelFactory.get_cell_info(cell)
            for cell in BatteryModelFactory.list_available_cells()
        }
    }


@router.get("/models/packs", response_model=Dict[str, Any])
async def list_pack_configurations():
    """List available pack configurations in the library"""
    return {
        "success": True,
        "packs": BatteryModelFactory.list_available_packs(),
        "details": {
            pack: BatteryModelFactory.get_pack_info(pack)
            for pack in BatteryModelFactory.list_available_packs()
        }
    }


@router.post("/models/create", response_model=Dict[str, Any])
async def create_battery_model(request: BatteryModelRequest):
    """
    Create a battery model from library components

    Combines cell and pack configurations to create a complete battery model
    for simulation and analysis.
    """
    try:
        model = BatteryModelFactory.create_model(
            model_id=request.model_id,
            name=request.name,
            cell_type=request.cell_type,
            pack_type=request.pack_type,
        )

        return {
            "success": True,
            "model": model.to_dict(),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health", response_model=Dict[str, Any])
async def digital_twin_health():
    """Health check for digital twin services"""
    return {
        "status": "ok",
        "services": {
            "simulator": pybamm_simulator.is_loaded,
            "state_estimator": state_estimator.is_loaded,
            "degradation_predictor": degradation_predictor.is_loaded,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
