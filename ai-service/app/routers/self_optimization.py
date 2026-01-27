"""
Self-Optimization API Router
Endpoints for genetic optimization and RL-based BESS control.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import asyncio

from app.services.self_optimization import (
    GeneticOptimizer,
    OptimizationConfig,
    RLAgent,
    RLConfig,
    BESSEnvironment,
    RewardCalculator,
    RewardWeights,
    ExperienceBuffer,
    Experience
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/self-optimization", tags=["Self-Optimization"])

# Global instances
_optimizer: Optional[GeneticOptimizer] = None
_rl_agent: Optional[RLAgent] = None
_reward_calculator: Optional[RewardCalculator] = None
_experience_buffer: Optional[ExperienceBuffer] = None

# Active jobs
_active_jobs: Dict[str, Dict[str, Any]] = {}


# ============================================
# SCHEMAS
# ============================================

class GeneticOptimizationRequest(BaseModel):
    """Request for genetic optimization"""
    price_forecast: List[float] = Field(..., min_items=24, max_items=24)
    load_forecast: List[float] = Field(..., min_items=24, max_items=24)
    solar_forecast: Optional[List[float]] = None
    battery_capacity_kwh: float = Field(default=100.0, ge=1)
    max_power_kw: float = Field(default=50.0, ge=1)
    population_size: int = Field(default=100, ge=10, le=500)
    generations: int = Field(default=50, ge=5, le=200)


class RLTrainingRequest(BaseModel):
    """Request for RL training"""
    algorithm: str = Field(default="PPO", pattern="^(PPO|SAC|TD3|A2C)$")
    total_timesteps: int = Field(default=50000, ge=1000, le=1000000)
    battery_capacity_kwh: float = Field(default=100.0, ge=1)
    max_power_kw: float = Field(default=50.0, ge=1)
    learning_rate: float = Field(default=3e-4, ge=1e-6, le=1e-2)


class RLPredictionRequest(BaseModel):
    """Request for RL action prediction"""
    soc: float = Field(..., ge=0, le=100)
    soh: float = Field(default=100.0, ge=0, le=100)
    temperature: float = Field(default=25.0, ge=-40, le=60)
    power: float = Field(default=0.0)
    hour: int = Field(..., ge=0, le=23)
    price: float = Field(..., ge=0)
    load: float = Field(default=0.0, ge=0)
    solar: float = Field(default=0.0, ge=0)


class RewardWeightsRequest(BaseModel):
    """Request to update reward weights"""
    arbitrage: float = Field(default=1.0, ge=-5, le=5)
    peak_shaving: float = Field(default=0.5, ge=-5, le=5)
    self_consumption: float = Field(default=0.3, ge=-5, le=5)
    grid_support: float = Field(default=0.2, ge=-5, le=5)
    degradation: float = Field(default=-0.5, ge=-5, le=5)
    soc_bounds: float = Field(default=-0.3, ge=-5, le=5)
    temperature: float = Field(default=-0.2, ge=-5, le=5)
    efficiency: float = Field(default=0.1, ge=-5, le=5)
    carbon: float = Field(default=0.2, ge=-5, le=5)
    demand_response: float = Field(default=0.4, ge=-5, le=5)


class ExperienceRequest(BaseModel):
    """Request to add experience"""
    state: List[float] = Field(..., min_items=10, max_items=10)
    action: List[float] = Field(..., min_items=1, max_items=1)
    reward: float
    next_state: List[float] = Field(..., min_items=10, max_items=10)
    done: bool


# ============================================
# GENETIC OPTIMIZATION ENDPOINTS
# ============================================

@router.post("/genetic/optimize")
async def run_genetic_optimization(
    request: GeneticOptimizationRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Run genetic optimization for BESS parameters.
    Returns optimized parameters for charge/discharge strategy.
    """
    global _optimizer

    try:
        config = OptimizationConfig(
            population_size=request.population_size,
            generations=request.generations
        )
        _optimizer = GeneticOptimizer(config)

        result = _optimizer.optimize_schedule(
            price_forecast=request.price_forecast,
            load_forecast=request.load_forecast,
            solar_forecast=request.solar_forecast,
            battery_capacity_kwh=request.battery_capacity_kwh,
            max_power_kw=request.max_power_kw
        )

        return {
            "success": True,
            "data": {
                "best_parameters": result.best_individual.to_dict(),
                "pareto_front_size": len(result.pareto_front),
                "generations": result.total_generations,
                "convergence_generation": result.convergence_generation,
                "execution_time_seconds": result.execution_time_seconds
            }
        }

    except Exception as e:
        logger.error(f"Genetic optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/genetic/optimize/async")
async def start_genetic_optimization_async(
    request: GeneticOptimizationRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Start genetic optimization in background.
    Returns job ID for status tracking.
    """
    import uuid
    job_id = str(uuid.uuid4())

    _active_jobs[job_id] = {
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "progress": 0,
        "result": None
    }

    async def run_optimization():
        try:
            config = OptimizationConfig(
                population_size=request.population_size,
                generations=request.generations
            )
            optimizer = GeneticOptimizer(config)

            def progress_callback(gen, pop):
                _active_jobs[job_id]["progress"] = (gen + 1) / request.generations * 100

            result = optimizer.optimize_schedule(
                price_forecast=request.price_forecast,
                load_forecast=request.load_forecast,
                solar_forecast=request.solar_forecast,
                battery_capacity_kwh=request.battery_capacity_kwh,
                max_power_kw=request.max_power_kw
            )

            _active_jobs[job_id]["status"] = "completed"
            _active_jobs[job_id]["result"] = result.to_dict()
            _active_jobs[job_id]["completed_at"] = datetime.now().isoformat()

        except Exception as e:
            _active_jobs[job_id]["status"] = "failed"
            _active_jobs[job_id]["error"] = str(e)

    background_tasks.add_task(run_optimization)

    return {
        "success": True,
        "data": {
            "job_id": job_id,
            "status": "started"
        }
    }


@router.get("/genetic/job/{job_id}")
async def get_optimization_job_status(job_id: str) -> Dict[str, Any]:
    """Get status of async optimization job"""
    if job_id not in _active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "success": True,
        "data": _active_jobs[job_id]
    }


# ============================================
# REINFORCEMENT LEARNING ENDPOINTS
# ============================================

@router.post("/rl/train")
async def train_rl_agent(
    request: RLTrainingRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Train RL agent for BESS control.
    This is a long-running operation that runs in background.
    """
    global _rl_agent

    import uuid
    job_id = str(uuid.uuid4())

    _active_jobs[job_id] = {
        "type": "rl_training",
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "algorithm": request.algorithm,
        "total_timesteps": request.total_timesteps,
        "result": None
    }

    async def run_training():
        global _rl_agent
        try:
            config = RLConfig(
                algorithm=request.algorithm,
                learning_rate=request.learning_rate,
                total_timesteps=request.total_timesteps
            )
            _rl_agent = RLAgent(config)
            _rl_agent.create_environment(
                battery_capacity_kwh=request.battery_capacity_kwh,
                max_power_kw=request.max_power_kw
            )

            result = _rl_agent.train(total_timesteps=request.total_timesteps)

            _active_jobs[job_id]["status"] = "completed"
            _active_jobs[job_id]["result"] = result
            _active_jobs[job_id]["completed_at"] = datetime.now().isoformat()

        except Exception as e:
            _active_jobs[job_id]["status"] = "failed"
            _active_jobs[job_id]["error"] = str(e)
            logger.error(f"RL training failed: {e}")

    background_tasks.add_task(run_training)

    return {
        "success": True,
        "data": {
            "job_id": job_id,
            "status": "training_started",
            "algorithm": request.algorithm,
            "total_timesteps": request.total_timesteps
        }
    }


@router.post("/rl/predict")
async def predict_action(request: RLPredictionRequest) -> Dict[str, Any]:
    """
    Get RL agent's recommended action for current state.
    """
    global _rl_agent

    if _rl_agent is None:
        # Return heuristic action if no trained agent
        return {
            "success": True,
            "data": {
                "action": 0.0,
                "source": "heuristic",
                "message": "No trained agent available, using heuristic"
            }
        }

    try:
        import numpy as np
        observation = np.array([
            request.soc,
            request.soh,
            request.temperature,
            request.power,
            request.hour,
            request.price,
            request.load,
            request.solar,
            60.0,  # grid_frequency
            0.0    # peak_demand
        ], dtype=np.float32)

        action, info = _rl_agent.predict(observation)

        # Convert action to power recommendation
        max_power = 50.0  # Default
        power_kw = action * max_power

        return {
            "success": True,
            "data": {
                "action": float(action),
                "power_kw": float(power_kw),
                "mode": "discharge" if power_kw > 0 else "charge" if power_kw < 0 else "idle",
                "source": info.get('source', 'rl_agent')
            }
        }

    except Exception as e:
        logger.error(f"RL prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rl/evaluate")
async def evaluate_agent() -> Dict[str, Any]:
    """Evaluate RL agent performance"""
    global _rl_agent

    if _rl_agent is None:
        raise HTTPException(status_code=400, detail="No trained agent available")

    try:
        metrics = _rl_agent.evaluate(n_episodes=10)
        return {
            "success": True,
            "data": metrics
        }
    except Exception as e:
        logger.error(f"RL evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rl/status")
async def get_rl_agent_status() -> Dict[str, Any]:
    """Get RL agent status"""
    global _rl_agent

    return {
        "success": True,
        "data": {
            "agent_loaded": _rl_agent is not None,
            "algorithm": _rl_agent.config.algorithm if _rl_agent else None,
            "model_loaded": _rl_agent.model is not None if _rl_agent else False
        }
    }


# ============================================
# REWARD CONFIGURATION ENDPOINTS
# ============================================

@router.get("/reward/weights")
async def get_reward_weights() -> Dict[str, Any]:
    """Get current reward weights"""
    global _reward_calculator

    if _reward_calculator is None:
        _reward_calculator = RewardCalculator()

    return {
        "success": True,
        "data": _reward_calculator.weights.to_dict()
    }


@router.put("/reward/weights")
async def update_reward_weights(request: RewardWeightsRequest) -> Dict[str, Any]:
    """Update reward weights"""
    global _reward_calculator

    if _reward_calculator is None:
        _reward_calculator = RewardCalculator()

    _reward_calculator.update_weights(request.dict())

    return {
        "success": True,
        "data": {
            "message": "Reward weights updated",
            "weights": _reward_calculator.weights.to_dict()
        }
    }


@router.get("/reward/presets")
async def get_reward_presets() -> Dict[str, Any]:
    """Get available reward weight presets"""
    return {
        "success": True,
        "data": {
            "economic": RewardWeights.economic_focus().to_dict(),
            "health": RewardWeights.battery_health_focus().to_dict(),
            "sustainable": RewardWeights.sustainability_focus().to_dict(),
            "default": RewardWeights().to_dict()
        }
    }


@router.post("/reward/preset/{preset_name}")
async def apply_reward_preset(preset_name: str) -> Dict[str, Any]:
    """Apply a reward weight preset"""
    global _reward_calculator

    presets = {
        "economic": RewardWeights.economic_focus,
        "health": RewardWeights.battery_health_focus,
        "sustainable": RewardWeights.sustainability_focus,
        "default": RewardWeights
    }

    if preset_name not in presets:
        raise HTTPException(status_code=400, detail=f"Unknown preset: {preset_name}")

    _reward_calculator = RewardCalculator(presets[preset_name]())

    return {
        "success": True,
        "data": {
            "preset": preset_name,
            "weights": _reward_calculator.weights.to_dict()
        }
    }


@router.get("/reward/statistics")
async def get_reward_statistics() -> Dict[str, Any]:
    """Get reward calculation statistics"""
    global _reward_calculator

    if _reward_calculator is None:
        _reward_calculator = RewardCalculator()

    return {
        "success": True,
        "data": {
            "statistics": _reward_calculator.get_statistics(),
            "component_analysis": _reward_calculator.get_component_analysis()
        }
    }


# ============================================
# EXPERIENCE BUFFER ENDPOINTS
# ============================================

@router.post("/buffer/add")
async def add_experience(request: ExperienceRequest) -> Dict[str, Any]:
    """Add experience to replay buffer"""
    global _experience_buffer

    if _experience_buffer is None:
        _experience_buffer = ExperienceBuffer(capacity=100000)

    import numpy as np
    experience = Experience(
        state=np.array(request.state),
        action=np.array(request.action),
        reward=request.reward,
        next_state=np.array(request.next_state),
        done=request.done
    )

    _experience_buffer.add(experience)

    return {
        "success": True,
        "data": {
            "buffer_size": len(_experience_buffer),
            "message": "Experience added"
        }
    }


@router.get("/buffer/statistics")
async def get_buffer_statistics() -> Dict[str, Any]:
    """Get experience buffer statistics"""
    global _experience_buffer

    if _experience_buffer is None:
        return {
            "success": True,
            "data": {"message": "No buffer initialized"}
        }

    return {
        "success": True,
        "data": _experience_buffer.get_statistics()
    }


@router.delete("/buffer/clear")
async def clear_buffer() -> Dict[str, Any]:
    """Clear experience buffer"""
    global _experience_buffer

    if _experience_buffer is not None:
        _experience_buffer.clear()

    return {
        "success": True,
        "data": {"message": "Buffer cleared"}
    }


# ============================================
# JOBS MANAGEMENT
# ============================================

@router.get("/jobs")
async def list_jobs() -> Dict[str, Any]:
    """List all optimization/training jobs"""
    return {
        "success": True,
        "data": {
            "jobs": list(_active_jobs.keys()),
            "total": len(_active_jobs)
        }
    }


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> Dict[str, Any]:
    """Delete job from tracking"""
    if job_id in _active_jobs:
        del _active_jobs[job_id]

    return {
        "success": True,
        "data": {"message": f"Job {job_id} deleted"}
    }
