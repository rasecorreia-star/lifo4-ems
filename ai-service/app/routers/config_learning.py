"""
Config Learning Router
API endpoints for AI-powered configuration learning and optimization.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum

from app.services.config_learning import (
    ConfigStore,
    ConfigLearner,
    ConfigOptimizer,
    SimilarityEngine,
)
from app.services.config_learning.config_learner import LearningStrategy, OperationalSample
from app.services.config_learning.config_optimizer import (
    OptimizationObjective,
    OperatingConditions,
)
from app.services.config_learning.similarity_engine import DeviceProfile

router = APIRouter(prefix="/config-learning", tags=["config-learning"])

# Initialize services
config_store = ConfigStore()
config_learner = ConfigLearner()
config_optimizer = ConfigOptimizer()
similarity_engine = SimilarityEngine()


# ============== Request/Response Models ==============

class ConfigCreateRequest(BaseModel):
    """Request to create a configuration"""
    device_id: str
    device_type: str
    parameters: Dict[str, float]
    source: str = "manual"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConfigUpdateRequest(BaseModel):
    """Request to update a configuration"""
    parameters: Dict[str, float]
    change_reason: str


class OperationalSampleRequest(BaseModel):
    """Request to add operational sample"""
    device_id: str
    config: Dict[str, float]
    ambient_temperature: float
    soc_start: float
    soc_end: float
    power_kw: float
    duration_hours: float
    efficiency: float
    degradation_rate: float
    revenue: float = 0.0


class LearnRequest(BaseModel):
    """Request to trigger learning"""
    device_id: str
    strategy: str = "bayesian"
    iterations: int = 100


class OptimizeRequest(BaseModel):
    """Request to optimize configuration"""
    base_config: Dict[str, float]
    ambient_temperature: float
    soc: float
    soh: float
    load_profile: str = "stable"
    energy_price: float = 100.0
    time_of_day: int = 12
    grid_demand: str = "medium"
    objective: str = "balanced"


class DeviceProfileRequest(BaseModel):
    """Request to register a device profile"""
    device_id: str
    device_type: str
    manufacturer: str
    model: str
    capacity_kwh: float
    power_kw: float
    voltage_nominal: float
    cells_in_series: int
    cells_in_parallel: int
    modules_count: int
    installation_date: str  # ISO format
    climate_zone: str
    application: str
    features: List[str] = Field(default_factory=list)


class FindSimilarRequest(BaseModel):
    """Request to find similar devices"""
    device_id: str
    limit: int = 10
    min_similarity: float = 0.5


class TransferConfigRequest(BaseModel):
    """Request to transfer configuration"""
    source_device_id: str
    target_device_id: str
    source_config: Dict[str, Any]


# ============== Configuration Store Endpoints ==============

@router.post("/configs")
async def create_config(request: ConfigCreateRequest):
    """Create a new configuration"""
    config_id = config_store.create_config(
        device_id=request.device_id,
        device_type=request.device_type,
        parameters=request.parameters,
        source=request.source,
        metadata=request.metadata
    )

    return {
        "success": True,
        "config_id": config_id,
        "message": f"Configuration created for device {request.device_id}"
    }


@router.get("/configs/{config_id}")
async def get_config(config_id: str):
    """Get configuration by ID"""
    config = config_store.get_config(config_id)

    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return {
        "id": config.id,
        "device_id": config.device_id,
        "device_type": config.device_type,
        "parameters": config.parameters,
        "source": config.source,
        "performance_score": config.performance_score,
        "usage_count": config.usage_count,
        "created_at": config.created_at.isoformat(),
        "updated_at": config.updated_at.isoformat(),
        "metadata": config.metadata
    }


@router.put("/configs/{config_id}")
async def update_config(config_id: str, request: ConfigUpdateRequest):
    """Update configuration parameters"""
    success = config_store.update_config(
        config_id=config_id,
        new_parameters=request.parameters,
        change_reason=request.change_reason
    )

    if not success:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return {
        "success": True,
        "message": f"Configuration {config_id} updated"
    }


@router.get("/configs/device/{device_id}")
async def get_device_configs(device_id: str):
    """Get all configurations for a device"""
    configs = config_store.get_device_configs(device_id)

    return {
        "device_id": device_id,
        "count": len(configs),
        "configs": [
            {
                "id": c.id,
                "device_type": c.device_type,
                "parameters": c.parameters,
                "source": c.source,
                "performance_score": c.performance_score,
                "created_at": c.created_at.isoformat()
            }
            for c in configs
        ]
    }


@router.get("/configs/search")
async def search_configs(
    device_type: Optional[str] = None,
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    source: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """Search configurations with filters"""
    results = config_store.search_configs(
        device_type=device_type,
        min_score=min_score,
        source=source,
        limit=limit
    )

    return {
        "count": len(results),
        "results": [
            {
                "id": c.id,
                "device_id": c.device_id,
                "device_type": c.device_type,
                "parameters": c.parameters,
                "performance_score": c.performance_score,
                "source": c.source
            }
            for c in results
        ]
    }


@router.get("/configs/best/{device_type}")
async def get_best_config(device_type: str):
    """Get best performing configuration for device type"""
    config = config_store.get_best_config(device_type)

    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"No configuration found for device type {device_type}"
        )

    return {
        "id": config.id,
        "device_id": config.device_id,
        "device_type": config.device_type,
        "parameters": config.parameters,
        "performance_score": config.performance_score,
        "usage_count": config.usage_count
    }


@router.get("/configs/{config_id}/versions")
async def get_config_versions(config_id: str):
    """Get version history for a configuration"""
    versions = config_store.get_version_history(config_id)

    return {
        "config_id": config_id,
        "version_count": len(versions),
        "versions": [
            {
                "version": v.version,
                "parameters": v.parameters,
                "change_reason": v.change_reason,
                "changed_at": v.changed_at.isoformat()
            }
            for v in versions
        ]
    }


@router.post("/configs/{config_id}/record-performance")
async def record_performance(config_id: str, score: float = Query(ge=0.0, le=1.0)):
    """Record performance score for a configuration"""
    success = config_store.record_performance(config_id, score)

    if not success:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return {
        "success": True,
        "message": f"Performance score {score} recorded for config {config_id}"
    }


# ============== Learning Endpoints ==============

@router.post("/learning/samples")
async def add_sample(request: OperationalSampleRequest):
    """Add operational sample for learning"""
    sample = OperationalSample(
        device_id=request.device_id,
        timestamp=datetime.now(),
        config=request.config,
        ambient_temperature=request.ambient_temperature,
        soc_start=request.soc_start,
        soc_end=request.soc_end,
        power_kw=request.power_kw,
        duration_hours=request.duration_hours,
        efficiency=request.efficiency,
        degradation_rate=request.degradation_rate,
        revenue=request.revenue
    )

    config_learner.add_sample(sample)

    return {
        "success": True,
        "message": f"Sample added for device {request.device_id}",
        "total_samples": len(config_learner.samples.get(request.device_id, []))
    }


@router.post("/learning/learn")
async def trigger_learning(request: LearnRequest):
    """Trigger learning process"""
    try:
        strategy = LearningStrategy(request.strategy)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid strategy. Valid options: {[s.value for s in LearningStrategy]}"
        )

    # Get current config for device
    device_configs = config_store.get_device_configs(request.device_id)
    if not device_configs:
        raise HTTPException(
            status_code=404,
            detail=f"No configuration found for device {request.device_id}"
        )

    current_config = device_configs[0].parameters

    result = config_learner.learn(
        device_id=request.device_id,
        current_config=current_config,
        strategy=strategy,
        iterations=request.iterations
    )

    return {
        "success": result.success,
        "device_id": request.device_id,
        "strategy": request.strategy,
        "optimized_parameters": result.optimized_parameters,
        "expected_improvement": result.expected_improvement,
        "confidence": result.confidence,
        "convergence_history": result.convergence_history[-10:],  # Last 10
        "recommendations": result.recommendations
    }


@router.get("/learning/status/{device_id}")
async def get_learning_status(device_id: str):
    """Get learning status for device"""
    samples = config_learner.samples.get(device_id, [])
    history = config_learner.learning_history.get(device_id, [])

    return {
        "device_id": device_id,
        "total_samples": len(samples),
        "learning_runs": len(history),
        "last_run": history[-1] if history else None,
        "ready_to_learn": len(samples) >= 10
    }


# ============== Optimization Endpoints ==============

@router.post("/optimization/optimize")
async def optimize_config(request: OptimizeRequest):
    """Optimize configuration for current conditions"""
    try:
        objective = OptimizationObjective(request.objective)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid objective. Valid options: {[o.value for o in OptimizationObjective]}"
        )

    conditions = OperatingConditions(
        ambient_temperature=request.ambient_temperature,
        soc=request.soc,
        soh=request.soh,
        load_profile=request.load_profile,
        energy_price=request.energy_price,
        time_of_day=request.time_of_day,
        grid_demand=request.grid_demand
    )

    result = config_optimizer.optimize(
        base_config=request.base_config,
        conditions=conditions,
        objective=objective
    )

    return {
        "success": result.success,
        "optimized_parameters": result.optimized_parameters,
        "expected_improvement": result.expected_improvement,
        "objective_scores": result.objective_scores,
        "recommendations": result.recommendations,
        "conditions_considered": result.conditions_considered
    }


@router.post("/optimization/recommendations")
async def get_recommendations(request: OptimizeRequest):
    """Get recommendations without full optimization"""
    conditions = OperatingConditions(
        ambient_temperature=request.ambient_temperature,
        soc=request.soc,
        soh=request.soh,
        load_profile=request.load_profile,
        energy_price=request.energy_price,
        time_of_day=request.time_of_day,
        grid_demand=request.grid_demand
    )

    recommendations = config_optimizer.get_recommendation(
        conditions=conditions,
        current_config=request.base_config
    )

    return {
        "recommendations": recommendations,
        "conditions": {
            "temperature": request.ambient_temperature,
            "soc": request.soc,
            "energy_price": request.energy_price
        }
    }


# ============== Similarity Engine Endpoints ==============

@router.post("/similarity/devices")
async def register_device(request: DeviceProfileRequest):
    """Register a device profile"""
    profile = DeviceProfile(
        device_id=request.device_id,
        device_type=request.device_type,
        manufacturer=request.manufacturer,
        model=request.model,
        capacity_kwh=request.capacity_kwh,
        power_kw=request.power_kw,
        voltage_nominal=request.voltage_nominal,
        cells_in_series=request.cells_in_series,
        cells_in_parallel=request.cells_in_parallel,
        modules_count=request.modules_count,
        installation_date=datetime.fromisoformat(request.installation_date),
        climate_zone=request.climate_zone,
        application=request.application,
        features=request.features
    )

    similarity_engine.register_device(profile)

    return {
        "success": True,
        "message": f"Device {request.device_id} registered",
        "total_devices": len(similarity_engine.devices)
    }


@router.get("/similarity/devices/{device_id}")
async def get_device(device_id: str):
    """Get device profile"""
    device = similarity_engine.get_device(device_id)

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    return {
        "device_id": device.device_id,
        "device_type": device.device_type,
        "manufacturer": device.manufacturer,
        "model": device.model,
        "capacity_kwh": device.capacity_kwh,
        "power_kw": device.power_kw,
        "voltage_nominal": device.voltage_nominal,
        "cells_in_series": device.cells_in_series,
        "cells_in_parallel": device.cells_in_parallel,
        "climate_zone": device.climate_zone,
        "application": device.application,
        "features": device.features
    }


@router.get("/similarity/devices")
async def list_devices(
    device_type: Optional[str] = None,
    climate: Optional[str] = None,
    application: Optional[str] = None
):
    """List devices with optional filters"""
    devices = similarity_engine.list_devices(
        device_type=device_type,
        climate=climate,
        application=application
    )

    return {
        "count": len(devices),
        "devices": [
            {
                "device_id": d.device_id,
                "device_type": d.device_type,
                "manufacturer": d.manufacturer,
                "capacity_kwh": d.capacity_kwh,
                "climate_zone": d.climate_zone,
                "application": d.application
            }
            for d in devices
        ]
    }


@router.post("/similarity/find-similar")
async def find_similar_devices(request: FindSimilarRequest):
    """Find devices similar to a target"""
    target = similarity_engine.get_device(request.device_id)

    if not target:
        raise HTTPException(status_code=404, detail="Target device not found")

    similar = similarity_engine.find_similar(
        target=target,
        limit=request.limit,
        min_similarity=request.min_similarity
    )

    return {
        "target_device": request.device_id,
        "count": len(similar),
        "similar_devices": [
            {
                "device_id": s.device.device_id,
                "similarity_score": s.similarity_score,
                "matching_factors": s.matching_factors,
                "device_type": s.device.device_type,
                "manufacturer": s.device.manufacturer
            }
            for s in similar
        ]
    }


@router.post("/similarity/transfer-config")
async def transfer_configuration(request: TransferConfigRequest):
    """Get configuration transfer recommendations"""
    source = similarity_engine.get_device(request.source_device_id)
    target = similarity_engine.get_device(request.target_device_id)

    if not source:
        raise HTTPException(status_code=404, detail="Source device not found")
    if not target:
        raise HTTPException(status_code=404, detail="Target device not found")

    result = similarity_engine.get_transfer_recommendations(
        source=source,
        target=target,
        source_config=request.source_config
    )

    return {
        "source_device": request.source_device_id,
        "target_device": request.target_device_id,
        "similarity": result["similarity"],
        "confidence": result["confidence"],
        "adapted_config": result["adapted_config"],
        "recommendations": result["recommendations"]
    }


@router.get("/similarity/fleet-statistics")
async def get_fleet_statistics():
    """Get statistics about registered fleet"""
    stats = similarity_engine.get_fleet_statistics()
    return stats


# ============== Defaults Endpoints ==============

@router.get("/defaults/{device_type}")
async def get_default_config(device_type: str):
    """Get default configuration for device type"""
    from app.services.config_learning.config_store import DEFAULT_CONFIGS

    if device_type not in DEFAULT_CONFIGS:
        raise HTTPException(
            status_code=404,
            detail=f"No default config for {device_type}. Available: {list(DEFAULT_CONFIGS.keys())}"
        )

    return {
        "device_type": device_type,
        "parameters": DEFAULT_CONFIGS[device_type]
    }


@router.get("/defaults")
async def list_default_configs():
    """List all available default configurations"""
    from app.services.config_learning.config_store import DEFAULT_CONFIGS

    return {
        "available_types": list(DEFAULT_CONFIGS.keys()),
        "configs": DEFAULT_CONFIGS
    }
