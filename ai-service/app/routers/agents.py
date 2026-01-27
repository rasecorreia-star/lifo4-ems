"""
Multi-Agent System API Router
Endpoints for managing and interacting with the BESS multi-agent system.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum
import asyncio
import logging

from ..services.agents import (
    BaseAgent,
    AgentState,
    AgentMessage,
    AgentPriority,
    BMSAgent,
    OptimizationAgent,
    SafetyAgent,
    AgentCoordinator,
    CoordinationStrategy
)
from ..services.agents.coordinator import AgentRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["Multi-Agent System"])

# Global coordinator instance
_coordinator: Optional[AgentCoordinator] = None


class CoordinationStrategyEnum(str, Enum):
    HIERARCHICAL = "hierarchical"
    COLLABORATIVE = "collaborative"
    MARKET_BASED = "market_based"
    BLACKBOARD = "blackboard"
    CONTRACT_NET = "contract_net"


class AgentTypeEnum(str, Enum):
    BMS = "bms"
    OPTIMIZATION = "optimization"
    SAFETY = "safety"


class PriorityEnum(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"
    BACKGROUND = "background"


# Request/Response Models

class InitializeSystemRequest(BaseModel):
    strategy: CoordinationStrategyEnum = CoordinationStrategyEnum.HIERARCHICAL
    auto_register_agents: bool = True


class RegisterAgentRequest(BaseModel):
    agent_type: AgentTypeEnum
    agent_id: Optional[str] = None
    name: Optional[str] = None
    role: str = "worker"


class CreateTaskRequest(BaseModel):
    description: str
    required_capabilities: List[str]
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: PriorityEnum = PriorityEnum.NORMAL
    deadline_seconds: Optional[int] = None


class SendMessageRequest(BaseModel):
    receiver_id: str
    topic: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: PriorityEnum = PriorityEnum.NORMAL


class BroadcastRequest(BaseModel):
    topic: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: PriorityEnum = PriorityEnum.NORMAL


class UpdateThresholdRequest(BaseModel):
    zone: str
    parameter: str
    warning_low: Optional[float] = None
    warning_high: Optional[float] = None
    alarm_low: Optional[float] = None
    alarm_high: Optional[float] = None
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None


class OptimizationRequest(BaseModel):
    horizon_hours: int = 24
    objectives: List[str] = Field(default=["minimize_cost"])
    constraints: Dict[str, Any] = Field(default_factory=dict)


class TelemetryData(BaseModel):
    cells: Optional[List[Dict[str, Any]]] = None
    modules: Optional[List[Dict[str, Any]]] = None
    system: Optional[Dict[str, Any]] = None
    environment: Optional[Dict[str, Any]] = None


class BlackboardWriteRequest(BaseModel):
    key: str
    value: Any


# Helper Functions

def get_coordinator() -> AgentCoordinator:
    """Get the coordinator instance"""
    global _coordinator
    if _coordinator is None:
        raise HTTPException(
            status_code=503,
            detail="Multi-agent system not initialized. Call POST /agents/initialize first."
        )
    return _coordinator


def priority_to_enum(priority: PriorityEnum) -> AgentPriority:
    """Convert priority string to enum"""
    mapping = {
        PriorityEnum.CRITICAL: AgentPriority.CRITICAL,
        PriorityEnum.HIGH: AgentPriority.HIGH,
        PriorityEnum.NORMAL: AgentPriority.NORMAL,
        PriorityEnum.LOW: AgentPriority.LOW,
        PriorityEnum.BACKGROUND: AgentPriority.BACKGROUND
    }
    return mapping.get(priority, AgentPriority.NORMAL)


# Endpoints

@router.post("/initialize")
async def initialize_system(request: InitializeSystemRequest):
    """
    Initialize the multi-agent system with a coordination strategy.
    """
    global _coordinator

    # Map strategy
    strategy_map = {
        CoordinationStrategyEnum.HIERARCHICAL: CoordinationStrategy.HIERARCHICAL,
        CoordinationStrategyEnum.COLLABORATIVE: CoordinationStrategy.COLLABORATIVE,
        CoordinationStrategyEnum.MARKET_BASED: CoordinationStrategy.MARKET_BASED,
        CoordinationStrategyEnum.BLACKBOARD: CoordinationStrategy.BLACKBOARD,
        CoordinationStrategyEnum.CONTRACT_NET: CoordinationStrategy.CONTRACT_NET
    }

    strategy = strategy_map.get(request.strategy, CoordinationStrategy.HIERARCHICAL)

    # Create coordinator
    _coordinator = AgentCoordinator(
        agent_id="coordinator",
        name="BESS Agent Coordinator",
        strategy=strategy
    )

    # Start coordinator
    await _coordinator.start()

    # Auto-register default agents if requested
    if request.auto_register_agents:
        # BMS Agent
        bms_agent = BMSAgent(agent_id="bms_agent", name="BMS Agent")
        await _coordinator.register_agent(bms_agent, AgentRole.SPECIALIST)

        # Optimization Agent
        opt_agent = OptimizationAgent(agent_id="optimization_agent", name="Optimization Agent")
        await _coordinator.register_agent(opt_agent, AgentRole.SPECIALIST)

        # Safety Agent (highest priority)
        safety_agent = SafetyAgent(agent_id="safety_agent", name="Safety Agent")
        await _coordinator.register_agent(safety_agent, AgentRole.SUPERVISOR)

    return {
        "success": True,
        "strategy": request.strategy,
        "agents_registered": len(_coordinator.agents) if _coordinator else 0,
        "message": "Multi-agent system initialized"
    }


@router.delete("/shutdown")
async def shutdown_system():
    """
    Shutdown the multi-agent system.
    """
    global _coordinator

    if _coordinator is None:
        return {"success": True, "message": "System not running"}

    await _coordinator.stop()
    _coordinator = None

    return {"success": True, "message": "Multi-agent system shutdown complete"}


@router.get("/status")
async def get_system_status():
    """
    Get the current status of the multi-agent system.
    """
    coordinator = get_coordinator()
    return coordinator.get_coordination_status()


@router.post("/agents/register")
async def register_agent(request: RegisterAgentRequest):
    """
    Register a new agent with the system.
    """
    coordinator = get_coordinator()

    # Create agent based on type
    agent_id = request.agent_id or f"{request.agent_type.value}_agent_{datetime.now().timestamp()}"
    name = request.name or f"{request.agent_type.value.upper()} Agent"

    if request.agent_type == AgentTypeEnum.BMS:
        agent = BMSAgent(agent_id=agent_id, name=name)
    elif request.agent_type == AgentTypeEnum.OPTIMIZATION:
        agent = OptimizationAgent(agent_id=agent_id, name=name)
    elif request.agent_type == AgentTypeEnum.SAFETY:
        agent = SafetyAgent(agent_id=agent_id, name=name)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown agent type: {request.agent_type}")

    # Map role
    role_map = {
        "coordinator": AgentRole.COORDINATOR,
        "supervisor": AgentRole.SUPERVISOR,
        "specialist": AgentRole.SPECIALIST,
        "worker": AgentRole.WORKER
    }
    role = role_map.get(request.role.lower(), AgentRole.WORKER)

    # Register
    success = await coordinator.register_agent(agent, role)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to register agent")

    return {
        "success": True,
        "agent_id": agent_id,
        "agent_type": request.agent_type,
        "role": role.value
    }


@router.delete("/agents/{agent_id}")
async def unregister_agent(agent_id: str):
    """
    Unregister an agent from the system.
    """
    coordinator = get_coordinator()

    success = await coordinator.unregister_agent(agent_id)

    if not success:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    return {"success": True, "agent_id": agent_id, "message": "Agent unregistered"}


@router.get("/agents/{agent_id}")
async def get_agent_status(agent_id: str):
    """
    Get the status of a specific agent.
    """
    coordinator = get_coordinator()

    status = coordinator.get_agent_status(agent_id)

    if status is None:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    return status


@router.get("/agents")
async def list_agents():
    """
    List all registered agents.
    """
    coordinator = get_coordinator()

    agents = []
    for agent_id, reg in coordinator.agents.items():
        agents.append({
            "agent_id": agent_id,
            "name": reg.agent.name,
            "role": reg.role.value,
            "state": reg.agent.state.value,
            "capabilities": reg.capabilities,
            "last_seen": reg.last_seen.isoformat()
        })

    return {"agents": agents, "count": len(agents)}


@router.post("/tasks")
async def create_task(request: CreateTaskRequest):
    """
    Create and allocate a new task.
    """
    coordinator = get_coordinator()

    deadline = None
    if request.deadline_seconds:
        from datetime import timedelta
        deadline = datetime.now() + timedelta(seconds=request.deadline_seconds)

    task = await coordinator.create_task(
        description=request.description,
        required_capabilities=request.required_capabilities,
        payload=request.payload,
        priority=priority_to_enum(request.priority),
        deadline=deadline
    )

    return {
        "success": True,
        "task_id": task.id,
        "status": task.status,
        "assigned_to": task.assigned_agent
    }


@router.get("/tasks")
async def list_tasks():
    """
    List all tasks (pending, active, and recent completed).
    """
    coordinator = get_coordinator()

    return {
        "pending": [
            {
                "id": t.id,
                "description": t.description,
                "status": t.status,
                "priority": t.priority.name,
                "created_at": t.created_at.isoformat()
            }
            for t in coordinator.pending_tasks.values()
        ],
        "active": [
            {
                "id": t.id,
                "description": t.description,
                "status": t.status,
                "assigned_to": t.assigned_agent,
                "started_at": t.started_at.isoformat() if t.started_at else None
            }
            for t in coordinator.active_tasks.values()
        ],
        "completed_recent": [
            {
                "id": t.id,
                "description": t.description,
                "status": t.status,
                "assigned_to": t.assigned_agent,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None
            }
            for t in coordinator.completed_tasks[-20:]
        ],
        "stats": coordinator.task_stats
    }


@router.post("/messages/send")
async def send_message(request: SendMessageRequest):
    """
    Send a message to a specific agent.
    """
    coordinator = get_coordinator()

    message = AgentMessage(
        sender_id="api",
        receiver_id=request.receiver_id,
        topic=request.topic,
        payload=request.payload,
        priority=priority_to_enum(request.priority)
    )

    await coordinator.router.route_message(message)

    return {
        "success": True,
        "message_id": message.id,
        "receiver": request.receiver_id
    }


@router.post("/messages/broadcast")
async def broadcast_message(request: BroadcastRequest):
    """
    Broadcast a message to all agents.
    """
    coordinator = get_coordinator()

    await coordinator._broadcast_message({
        "topic": request.topic,
        "payload": request.payload,
        "priority": priority_to_enum(request.priority).value
    })

    return {
        "success": True,
        "recipients": len(coordinator.agents)
    }


# Safety Agent Endpoints

@router.get("/safety/status")
async def get_safety_status():
    """
    Get the current safety status.
    """
    coordinator = get_coordinator()

    safety_reg = coordinator.agents.get("safety_agent")
    if not safety_reg:
        raise HTTPException(status_code=404, detail="Safety agent not found")

    safety_agent: SafetyAgent = safety_reg.agent
    return safety_agent.get_safety_status()


@router.post("/safety/telemetry")
async def process_telemetry(data: TelemetryData):
    """
    Send telemetry data to the safety agent for monitoring.
    """
    coordinator = get_coordinator()

    safety_reg = coordinator.agents.get("safety_agent")
    if not safety_reg:
        raise HTTPException(status_code=404, detail="Safety agent not found")

    message = AgentMessage(
        sender_id="api",
        receiver_id="safety_agent",
        topic="telemetry",
        payload=data.dict(exclude_none=True),
        priority=AgentPriority.HIGH
    )

    await coordinator.router.route_message(message)

    return {"success": True, "message": "Telemetry sent to safety agent"}


@router.post("/safety/emergency-stop")
async def emergency_stop():
    """
    Trigger emergency stop.
    """
    coordinator = get_coordinator()

    safety_reg = coordinator.agents.get("safety_agent")
    if not safety_reg:
        raise HTTPException(status_code=404, detail="Safety agent not found")

    safety_agent: SafetyAgent = safety_reg.agent

    result = await safety_agent._emergency_stop()

    return result


@router.post("/safety/thresholds")
async def update_threshold(request: UpdateThresholdRequest):
    """
    Update a safety threshold.
    """
    coordinator = get_coordinator()

    safety_reg = coordinator.agents.get("safety_agent")
    if not safety_reg:
        raise HTTPException(status_code=404, detail="Safety agent not found")

    message = AgentMessage(
        sender_id="api",
        receiver_id="safety_agent",
        topic="update_threshold",
        payload=request.dict(exclude_none=True)
    )

    await coordinator.router.route_message(message)

    return {"success": True, "message": "Threshold update sent"}


@router.get("/safety/events")
async def get_safety_events(
    level: Optional[str] = None,
    zone: Optional[str] = None,
    limit: int = 100
):
    """
    Get safety event history.
    """
    coordinator = get_coordinator()

    safety_reg = coordinator.agents.get("safety_agent")
    if not safety_reg:
        raise HTTPException(status_code=404, detail="Safety agent not found")

    safety_agent: SafetyAgent = safety_reg.agent

    from ..services.agents.safety_agent import SafetyLevel, SafetyZone

    level_enum = None
    zone_enum = None

    if level:
        try:
            level_enum = SafetyLevel[level.upper()]
        except KeyError:
            pass

    if zone:
        try:
            zone_enum = SafetyZone(zone.lower())
        except ValueError:
            pass

    events = safety_agent.get_event_history(
        level=level_enum,
        zone=zone_enum,
        limit=limit
    )

    return {"events": events, "count": len(events)}


# Optimization Agent Endpoints

@router.get("/optimization/status")
async def get_optimization_status():
    """
    Get the current optimization status.
    """
    coordinator = get_coordinator()

    opt_reg = coordinator.agents.get("optimization_agent")
    if not opt_reg:
        raise HTTPException(status_code=404, detail="Optimization agent not found")

    opt_agent: OptimizationAgent = opt_reg.agent
    return opt_agent.get_optimization_status()


@router.post("/optimization/run")
async def run_optimization(request: OptimizationRequest):
    """
    Run schedule optimization.
    """
    coordinator = get_coordinator()

    opt_reg = coordinator.agents.get("optimization_agent")
    if not opt_reg:
        raise HTTPException(status_code=404, detail="Optimization agent not found")

    message = AgentMessage(
        sender_id="api",
        receiver_id="optimization_agent",
        topic="optimize_schedule",
        payload={
            "horizon_hours": request.horizon_hours,
            "objectives": request.objectives,
            "constraints": request.constraints
        },
        priority=AgentPriority.HIGH
    )

    await coordinator.router.route_message(message)

    # Wait briefly for result
    await asyncio.sleep(0.5)

    opt_agent: OptimizationAgent = opt_reg.agent

    if opt_agent.optimization_history:
        last_result = opt_agent.optimization_history[-1]
        return {
            "success": last_result.success,
            "schedules": len(last_result.schedules),
            "expected_revenue": last_result.expected_revenue,
            "expected_cost": last_result.expected_cost,
            "optimization_time_ms": last_result.optimization_time_ms
        }

    return {"success": True, "message": "Optimization started"}


@router.get("/optimization/schedules")
async def get_schedules():
    """
    Get current active and pending schedules.
    """
    coordinator = get_coordinator()

    opt_reg = coordinator.agents.get("optimization_agent")
    if not opt_reg:
        raise HTTPException(status_code=404, detail="Optimization agent not found")

    opt_agent: OptimizationAgent = opt_reg.agent

    return {
        "active_schedules": [
            {
                "id": s.id,
                "type": s.schedule_type.value,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "power_setpoint_kw": s.power_setpoint,
                "objective": s.objective.value
            }
            for s in opt_agent.active_schedules
        ],
        "pending_schedules": [
            {
                "id": s.id,
                "type": s.schedule_type.value,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "power_setpoint_kw": s.power_setpoint
            }
            for s in opt_agent.pending_schedules
        ]
    }


@router.post("/optimization/price-signal")
async def send_price_signal(
    buy_price: float,
    sell_price: float,
    demand_charge: float = 0.0,
    grid_signal: float = 0.0
):
    """
    Send a price signal to the optimization agent.
    """
    coordinator = get_coordinator()

    message = AgentMessage(
        sender_id="api",
        receiver_id="optimization_agent",
        topic="price_update",
        payload={
            "timestamp": datetime.now().isoformat(),
            "buy_price": buy_price,
            "sell_price": sell_price,
            "demand_charge": demand_charge,
            "grid_signal": grid_signal
        },
        priority=AgentPriority.HIGH
    )

    await coordinator.router.route_message(message)

    return {"success": True, "message": "Price signal sent"}


# BMS Agent Endpoints

@router.get("/bms/status")
async def get_bms_status():
    """
    Get the current BMS agent status.
    """
    coordinator = get_coordinator()

    bms_reg = coordinator.agents.get("bms_agent")
    if not bms_reg:
        raise HTTPException(status_code=404, detail="BMS agent not found")

    bms_agent: BMSAgent = bms_reg.agent
    return bms_agent.get_bms_status()


@router.post("/bms/cell-data")
async def update_cell_data(cells: List[Dict[str, Any]]):
    """
    Send cell data to the BMS agent.
    """
    coordinator = get_coordinator()

    message = AgentMessage(
        sender_id="api",
        receiver_id="bms_agent",
        topic="cell_update",
        payload={"cells": cells},
        priority=AgentPriority.HIGH
    )

    await coordinator.router.route_message(message)

    return {"success": True, "cells_updated": len(cells)}


@router.post("/bms/request-balancing")
async def request_balancing():
    """
    Request cell balancing analysis.
    """
    coordinator = get_coordinator()

    message = AgentMessage(
        sender_id="api",
        receiver_id="bms_agent",
        topic="request_balancing",
        payload={},
        priority=AgentPriority.NORMAL
    )

    await coordinator.router.route_message(message)

    return {"success": True, "message": "Balancing analysis requested"}


# Blackboard Endpoints

@router.get("/blackboard")
async def get_blackboard_snapshot():
    """
    Get the current blackboard state.
    """
    coordinator = get_coordinator()
    return coordinator.blackboard.get_snapshot()


@router.post("/blackboard")
async def write_to_blackboard(request: BlackboardWriteRequest):
    """
    Write data to the blackboard.
    """
    coordinator = get_coordinator()

    watchers = await coordinator.blackboard.write(
        request.key,
        request.value,
        "api"
    )

    return {
        "success": True,
        "key": request.key,
        "watchers_notified": len(watchers)
    }


@router.get("/blackboard/{key}")
async def read_from_blackboard(key: str):
    """
    Read data from the blackboard.
    """
    coordinator = get_coordinator()

    value = await coordinator.blackboard.read(key)

    if value is None:
        raise HTTPException(status_code=404, detail=f"Key '{key}' not found")

    return {"key": key, "value": value}
