"""
Optimization Agent
Responsible for energy optimization, scheduling, and economic decisions.
"""

import asyncio
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentMessage,
    AgentPriority,
    MessageType
)

logger = logging.getLogger(__name__)


class OptimizationObjective(Enum):
    """Optimization objectives"""
    MINIMIZE_COST = "minimize_cost"
    MAXIMIZE_REVENUE = "maximize_revenue"
    MINIMIZE_DEGRADATION = "minimize_degradation"
    MAXIMIZE_AVAILABILITY = "maximize_availability"
    BALANCE_GRID = "balance_grid"
    PEAK_SHAVING = "peak_shaving"
    ARBITRAGE = "arbitrage"


class ScheduleType(Enum):
    """Types of operational schedules"""
    CHARGE = "charge"
    DISCHARGE = "discharge"
    IDLE = "idle"
    MAINTENANCE = "maintenance"
    EMERGENCY_RESERVE = "emergency_reserve"


@dataclass
class OptimizationConstraints:
    """Constraints for optimization"""
    min_soc: float = 0.1  # 10%
    max_soc: float = 0.95  # 95%
    max_charge_rate: float = 1.0  # C-rate
    max_discharge_rate: float = 1.0  # C-rate
    min_reserve_capacity: float = 0.2  # 20%
    max_cycles_per_day: int = 2
    temperature_limits: Tuple[float, float] = (15.0, 45.0)
    power_ramp_rate: float = 0.1  # % per second


@dataclass
class PriceSignal:
    """Energy price signal"""
    timestamp: datetime
    buy_price: float  # $/kWh
    sell_price: float  # $/kWh
    demand_charge: float  # $/kW
    grid_signal: float  # -1 to 1 (export to import need)


@dataclass
class Schedule:
    """Operational schedule"""
    id: str
    start_time: datetime
    end_time: datetime
    schedule_type: ScheduleType
    power_setpoint: float  # kW (positive = charge, negative = discharge)
    target_soc: Optional[float] = None
    priority: AgentPriority = AgentPriority.NORMAL
    objective: OptimizationObjective = OptimizationObjective.MINIMIZE_COST
    estimated_revenue: float = 0.0
    estimated_degradation: float = 0.0


@dataclass
class OptimizationResult:
    """Result of optimization run"""
    success: bool
    schedules: List[Schedule] = field(default_factory=list)
    expected_revenue: float = 0.0
    expected_cost: float = 0.0
    expected_degradation: float = 0.0
    optimization_time_ms: float = 0.0
    constraints_satisfied: bool = True
    warnings: List[str] = field(default_factory=list)


class OptimizationAgent(BaseAgent):
    """
    Agent responsible for energy optimization decisions.

    Capabilities:
    - Load forecasting integration
    - Price signal processing
    - Schedule optimization
    - Economic dispatch
    - Peak shaving
    - Arbitrage detection
    """

    def __init__(
        self,
        agent_id: str = "optimization_agent",
        name: str = "Optimization Agent"
    ):
        super().__init__(
            agent_id=agent_id,
            name=name,
            description="Energy optimization and scheduling agent"
        )

        # Default constraints
        self.constraints = OptimizationConstraints()

        # Current schedules
        self.active_schedules: List[Schedule] = []
        self.pending_schedules: List[Schedule] = []

        # Price forecasts
        self.price_forecasts: List[PriceSignal] = []

        # Load forecasts
        self.load_forecasts: Dict[datetime, float] = {}

        # Generation forecasts (solar/wind)
        self.generation_forecasts: Dict[datetime, float] = {}

        # Optimization parameters
        self.optimization_horizon_hours = 24
        self.time_step_minutes = 15

        # Performance tracking
        self.optimization_history: List[OptimizationResult] = []

        # Register message handlers
        self._setup_handlers()

    def _register_capabilities(self):
        """Register optimization capabilities"""
        capabilities = [
            AgentCapability(
                name="schedule_optimization",
                description="Optimize charge/discharge schedules based on prices and constraints",
                input_schema={
                    "type": "object",
                    "properties": {
                        "horizon_hours": {"type": "number"},
                        "objectives": {"type": "array", "items": {"type": "string"}},
                        "constraints": {"type": "object"}
                    }
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "schedules": {"type": "array"},
                        "expected_revenue": {"type": "number"}
                    }
                },
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="economic_dispatch",
                description="Calculate optimal power setpoints for current conditions",
                input_schema={
                    "type": "object",
                    "properties": {
                        "current_price": {"type": "number"},
                        "current_soc": {"type": "number"},
                        "demand": {"type": "number"}
                    }
                },
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="peak_shaving",
                description="Calculate setpoints for peak demand reduction",
                input_schema={
                    "type": "object",
                    "properties": {
                        "peak_threshold": {"type": "number"},
                        "current_demand": {"type": "number"}
                    }
                },
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="arbitrage_analysis",
                description="Identify arbitrage opportunities from price signals",
                input_schema={
                    "type": "object",
                    "properties": {
                        "price_forecast": {"type": "array"}
                    }
                },
                priority=AgentPriority.NORMAL
            ),
            AgentCapability(
                name="load_forecast",
                description="Process and integrate load forecasts",
                priority=AgentPriority.NORMAL
            ),
            AgentCapability(
                name="price_signal",
                description="Process real-time price signals",
                priority=AgentPriority.HIGH
            )
        ]

        for cap in capabilities:
            self.register_capability(cap)

    def _setup_handlers(self):
        """Setup message handlers"""
        self.register_handler("price_update", self._handle_price_update)
        self.register_handler("load_forecast", self._handle_load_forecast)
        self.register_handler("generation_forecast", self._handle_generation_forecast)
        self.register_handler("optimize_schedule", self._handle_optimize_schedule)
        self.register_handler("get_setpoint", self._handle_get_setpoint)
        self.register_handler("peak_shaving", self._handle_peak_shaving)
        self.register_handler("constraint_update", self._handle_constraint_update)

        # Subscribe to relevant topics
        self.subscribe("market/prices")
        self.subscribe("forecast/load")
        self.subscribe("forecast/generation")
        self.subscribe("bess/soc")
        self.subscribe("grid/demand")

    async def _process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process optimization tasks"""
        task_type = task.get('type', '')

        if task_type == 'optimize':
            return await self._run_optimization(task)
        elif task_type == 'dispatch':
            return await self._economic_dispatch(task)
        elif task_type == 'arbitrage_scan':
            return await self._scan_arbitrage(task)
        elif task_type == 'update_schedule':
            return await self._update_schedule(task)
        else:
            logger.warning(f"Unknown task type: {task_type}")
            return {'success': False, 'error': f'Unknown task type: {task_type}'}

    async def _handle_price_update(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle price signal updates"""
        payload = message.payload

        price_signal = PriceSignal(
            timestamp=datetime.fromisoformat(payload.get('timestamp', datetime.now().isoformat())),
            buy_price=payload.get('buy_price', 0.0),
            sell_price=payload.get('sell_price', 0.0),
            demand_charge=payload.get('demand_charge', 0.0),
            grid_signal=payload.get('grid_signal', 0.0)
        )

        # Add to forecasts
        self.price_forecasts.append(price_signal)

        # Keep only last 48 hours
        cutoff = datetime.now() - timedelta(hours=48)
        self.price_forecasts = [p for p in self.price_forecasts if p.timestamp > cutoff]

        # Update beliefs
        self.update_belief('current_price', {
            'buy': price_signal.buy_price,
            'sell': price_signal.sell_price,
            'timestamp': price_signal.timestamp.isoformat()
        })

        # Check if re-optimization needed
        if self._should_reoptimize(price_signal):
            self.add_task({'type': 'optimize', 'trigger': 'price_change'}, AgentPriority.HIGH)

        return {'success': True, 'price_recorded': True}

    async def _handle_load_forecast(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle load forecast updates"""
        payload = message.payload
        forecasts = payload.get('forecasts', [])

        for fc in forecasts:
            ts = datetime.fromisoformat(fc['timestamp'])
            self.load_forecasts[ts] = fc['load_kw']

        # Clean old forecasts
        cutoff = datetime.now() - timedelta(hours=1)
        self.load_forecasts = {k: v for k, v in self.load_forecasts.items() if k > cutoff}

        return {'success': True, 'forecasts_updated': len(forecasts)}

    async def _handle_generation_forecast(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle generation forecast updates"""
        payload = message.payload
        forecasts = payload.get('forecasts', [])

        for fc in forecasts:
            ts = datetime.fromisoformat(fc['timestamp'])
            self.generation_forecasts[ts] = fc['generation_kw']

        return {'success': True, 'forecasts_updated': len(forecasts)}

    async def _handle_optimize_schedule(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle schedule optimization request"""
        payload = message.payload

        result = await self._run_optimization({
            'type': 'optimize',
            'horizon_hours': payload.get('horizon_hours', self.optimization_horizon_hours),
            'objectives': payload.get('objectives', [OptimizationObjective.MINIMIZE_COST.value]),
            'constraints': payload.get('constraints', {})
        })

        return result

    async def _handle_get_setpoint(self, message: AgentMessage) -> Dict[str, Any]:
        """Get current optimal setpoint"""
        payload = message.payload

        current_soc = payload.get('current_soc', 0.5)
        current_price = payload.get('current_price', self.get_belief('current_price', {}))
        current_demand = payload.get('current_demand', 0.0)

        setpoint = await self._calculate_setpoint(current_soc, current_price, current_demand)

        return {
            'success': True,
            'setpoint_kw': setpoint['power'],
            'mode': setpoint['mode'],
            'reason': setpoint['reason']
        }

    async def _handle_peak_shaving(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle peak shaving request"""
        payload = message.payload

        peak_threshold = payload.get('peak_threshold', 0.0)
        current_demand = payload.get('current_demand', 0.0)
        current_soc = payload.get('current_soc', 0.5)

        if current_demand > peak_threshold:
            # Calculate discharge needed
            excess = current_demand - peak_threshold

            # Check if we have enough capacity
            available_power = self._calculate_available_discharge_power(current_soc)

            discharge_power = min(excess, available_power)

            return {
                'success': True,
                'action': 'discharge',
                'power_kw': -discharge_power,
                'reason': f'Peak shaving: demand {current_demand:.1f}kW exceeds threshold {peak_threshold:.1f}kW'
            }
        else:
            return {
                'success': True,
                'action': 'none',
                'power_kw': 0,
                'reason': f'Demand {current_demand:.1f}kW below threshold {peak_threshold:.1f}kW'
            }

    async def _handle_constraint_update(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle constraint updates"""
        payload = message.payload

        if 'min_soc' in payload:
            self.constraints.min_soc = payload['min_soc']
        if 'max_soc' in payload:
            self.constraints.max_soc = payload['max_soc']
        if 'max_charge_rate' in payload:
            self.constraints.max_charge_rate = payload['max_charge_rate']
        if 'max_discharge_rate' in payload:
            self.constraints.max_discharge_rate = payload['max_discharge_rate']
        if 'min_reserve_capacity' in payload:
            self.constraints.min_reserve_capacity = payload['min_reserve_capacity']

        return {'success': True, 'constraints_updated': True}

    async def _run_optimization(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Run schedule optimization"""
        start_time = datetime.now()

        horizon_hours = task.get('horizon_hours', self.optimization_horizon_hours)
        objectives = task.get('objectives', [OptimizationObjective.MINIMIZE_COST.value])
        custom_constraints = task.get('constraints', {})

        # Merge constraints
        constraints = self.constraints
        if custom_constraints:
            for key, value in custom_constraints.items():
                if hasattr(constraints, key):
                    setattr(constraints, key, value)

        # Get current state
        current_soc = self.get_belief('bess_soc', 0.5)
        battery_capacity = self.get_belief('battery_capacity_kwh', 1000.0)
        max_power = self.get_belief('max_power_kw', 500.0)

        # Generate time steps
        time_steps = int(horizon_hours * 60 / self.time_step_minutes)

        # Get price forecasts for horizon
        price_profile = self._get_price_profile(time_steps)

        # Get load forecasts
        load_profile = self._get_load_profile(time_steps)

        # Get generation forecasts
        gen_profile = self._get_generation_profile(time_steps)

        # Run optimization based on objectives
        if OptimizationObjective.ARBITRAGE.value in objectives:
            schedules = self._optimize_arbitrage(
                price_profile, current_soc, battery_capacity, max_power, constraints
            )
        elif OptimizationObjective.PEAK_SHAVING.value in objectives:
            schedules = self._optimize_peak_shaving(
                load_profile, current_soc, battery_capacity, max_power, constraints
            )
        else:
            # Default: minimize cost / maximize revenue
            schedules = self._optimize_economic(
                price_profile, load_profile, gen_profile,
                current_soc, battery_capacity, max_power, constraints
            )

        # Calculate expected outcomes
        expected_revenue, expected_cost, expected_degradation = self._calculate_outcomes(
            schedules, price_profile, battery_capacity
        )

        elapsed_ms = (datetime.now() - start_time).total_seconds() * 1000

        result = OptimizationResult(
            success=True,
            schedules=schedules,
            expected_revenue=expected_revenue,
            expected_cost=expected_cost,
            expected_degradation=expected_degradation,
            optimization_time_ms=elapsed_ms,
            constraints_satisfied=self._check_constraints(schedules, constraints)
        )

        # Store in history
        self.optimization_history.append(result)
        if len(self.optimization_history) > 100:
            self.optimization_history = self.optimization_history[-100:]

        # Update pending schedules
        self.pending_schedules = schedules

        return {
            'success': True,
            'schedules': [self._schedule_to_dict(s) for s in schedules],
            'expected_revenue': expected_revenue,
            'expected_cost': expected_cost,
            'expected_degradation': expected_degradation,
            'optimization_time_ms': elapsed_ms
        }

    def _optimize_arbitrage(
        self,
        price_profile: List[float],
        current_soc: float,
        capacity: float,
        max_power: float,
        constraints: OptimizationConstraints
    ) -> List[Schedule]:
        """Optimize for price arbitrage"""
        schedules = []

        if len(price_profile) < 2:
            return schedules

        # Find low and high price periods
        prices = np.array(price_profile)
        mean_price = np.mean(prices)
        std_price = np.std(prices)

        # Identify charge periods (price < mean - 0.5*std)
        low_threshold = mean_price - 0.5 * std_price
        high_threshold = mean_price + 0.5 * std_price

        now = datetime.now()
        step_duration = timedelta(minutes=self.time_step_minutes)

        soc = current_soc

        for i, price in enumerate(price_profile):
            step_start = now + i * step_duration
            step_end = step_start + step_duration

            if price <= low_threshold and soc < constraints.max_soc:
                # Charge during low prices
                charge_power = min(
                    max_power * constraints.max_charge_rate,
                    (constraints.max_soc - soc) * capacity / (self.time_step_minutes / 60)
                )

                if charge_power > 0:
                    schedules.append(Schedule(
                        id=f"arb_charge_{i}",
                        start_time=step_start,
                        end_time=step_end,
                        schedule_type=ScheduleType.CHARGE,
                        power_setpoint=charge_power,
                        objective=OptimizationObjective.ARBITRAGE,
                        estimated_revenue=-charge_power * (self.time_step_minutes / 60) * price
                    ))
                    soc += charge_power * (self.time_step_minutes / 60) / capacity

            elif price >= high_threshold and soc > constraints.min_soc:
                # Discharge during high prices
                discharge_power = min(
                    max_power * constraints.max_discharge_rate,
                    (soc - constraints.min_soc) * capacity / (self.time_step_minutes / 60)
                )

                if discharge_power > 0:
                    schedules.append(Schedule(
                        id=f"arb_discharge_{i}",
                        start_time=step_start,
                        end_time=step_end,
                        schedule_type=ScheduleType.DISCHARGE,
                        power_setpoint=-discharge_power,
                        objective=OptimizationObjective.ARBITRAGE,
                        estimated_revenue=discharge_power * (self.time_step_minutes / 60) * price
                    ))
                    soc -= discharge_power * (self.time_step_minutes / 60) / capacity

        return schedules

    def _optimize_peak_shaving(
        self,
        load_profile: List[float],
        current_soc: float,
        capacity: float,
        max_power: float,
        constraints: OptimizationConstraints
    ) -> List[Schedule]:
        """Optimize for peak demand reduction"""
        schedules = []

        if not load_profile:
            return schedules

        # Calculate peak threshold (e.g., 80th percentile)
        loads = np.array(load_profile)
        peak_threshold = np.percentile(loads, 80)

        now = datetime.now()
        step_duration = timedelta(minutes=self.time_step_minutes)

        soc = current_soc

        for i, load in enumerate(load_profile):
            step_start = now + i * step_duration
            step_end = step_start + step_duration

            if load > peak_threshold and soc > constraints.min_soc:
                # Discharge to shave peak
                excess = load - peak_threshold
                discharge_power = min(
                    excess,
                    max_power * constraints.max_discharge_rate,
                    (soc - constraints.min_soc) * capacity / (self.time_step_minutes / 60)
                )

                if discharge_power > 0:
                    schedules.append(Schedule(
                        id=f"peak_shave_{i}",
                        start_time=step_start,
                        end_time=step_end,
                        schedule_type=ScheduleType.DISCHARGE,
                        power_setpoint=-discharge_power,
                        objective=OptimizationObjective.PEAK_SHAVING
                    ))
                    soc -= discharge_power * (self.time_step_minutes / 60) / capacity

            elif load < peak_threshold * 0.5 and soc < constraints.max_soc:
                # Charge during low demand periods
                available_capacity = (constraints.max_soc - soc) * capacity
                charge_power = min(
                    max_power * constraints.max_charge_rate * 0.5,  # Moderate charge
                    available_capacity / (self.time_step_minutes / 60)
                )

                if charge_power > 0:
                    schedules.append(Schedule(
                        id=f"valley_charge_{i}",
                        start_time=step_start,
                        end_time=step_end,
                        schedule_type=ScheduleType.CHARGE,
                        power_setpoint=charge_power,
                        objective=OptimizationObjective.PEAK_SHAVING
                    ))
                    soc += charge_power * (self.time_step_minutes / 60) / capacity

        return schedules

    def _optimize_economic(
        self,
        price_profile: List[float],
        load_profile: List[float],
        gen_profile: List[float],
        current_soc: float,
        capacity: float,
        max_power: float,
        constraints: OptimizationConstraints
    ) -> List[Schedule]:
        """Economic optimization considering prices, load, and generation"""
        schedules = []

        now = datetime.now()
        step_duration = timedelta(minutes=self.time_step_minutes)

        # Ensure profiles have same length
        n_steps = min(len(price_profile), len(load_profile)) if load_profile else len(price_profile)

        soc = current_soc

        for i in range(n_steps):
            step_start = now + i * step_duration
            step_end = step_start + step_duration

            price = price_profile[i] if i < len(price_profile) else price_profile[-1]
            load = load_profile[i] if i < len(load_profile) else 0
            gen = gen_profile[i] if i < len(gen_profile) else 0

            # Net load (positive = need from grid, negative = excess generation)
            net_load = load - gen

            # Decision logic
            if net_load > 0 and soc > constraints.min_soc:
                # Need power - discharge if price is high
                avg_price = np.mean(price_profile) if price_profile else price
                if price > avg_price * 1.1:  # Price 10% above average
                    discharge_power = min(
                        net_load,
                        max_power * constraints.max_discharge_rate,
                        (soc - constraints.min_soc) * capacity / (self.time_step_minutes / 60)
                    )

                    if discharge_power > 0:
                        schedules.append(Schedule(
                            id=f"econ_discharge_{i}",
                            start_time=step_start,
                            end_time=step_end,
                            schedule_type=ScheduleType.DISCHARGE,
                            power_setpoint=-discharge_power,
                            objective=OptimizationObjective.MINIMIZE_COST,
                            estimated_revenue=discharge_power * (self.time_step_minutes / 60) * price
                        ))
                        soc -= discharge_power * (self.time_step_minutes / 60) / capacity

            elif net_load < 0 and soc < constraints.max_soc:
                # Excess generation - charge
                charge_power = min(
                    abs(net_load),
                    max_power * constraints.max_charge_rate,
                    (constraints.max_soc - soc) * capacity / (self.time_step_minutes / 60)
                )

                if charge_power > 0:
                    schedules.append(Schedule(
                        id=f"econ_charge_{i}",
                        start_time=step_start,
                        end_time=step_end,
                        schedule_type=ScheduleType.CHARGE,
                        power_setpoint=charge_power,
                        objective=OptimizationObjective.MINIMIZE_COST,
                        estimated_revenue=-charge_power * (self.time_step_minutes / 60) * price * 0.5  # Assume lower charge cost
                    ))
                    soc += charge_power * (self.time_step_minutes / 60) / capacity

            elif price < np.mean(price_profile) * 0.8 and soc < constraints.max_soc:
                # Low price - opportunistic charge
                charge_power = min(
                    max_power * constraints.max_charge_rate * 0.5,
                    (constraints.max_soc - soc) * capacity / (self.time_step_minutes / 60)
                )

                if charge_power > 0:
                    schedules.append(Schedule(
                        id=f"opp_charge_{i}",
                        start_time=step_start,
                        end_time=step_end,
                        schedule_type=ScheduleType.CHARGE,
                        power_setpoint=charge_power,
                        objective=OptimizationObjective.MINIMIZE_COST
                    ))
                    soc += charge_power * (self.time_step_minutes / 60) / capacity

        return schedules

    async def _economic_dispatch(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate optimal dispatch for current conditions"""
        current_soc = task.get('current_soc', self.get_belief('bess_soc', 0.5))
        current_price = task.get('current_price', {})
        current_demand = task.get('current_demand', 0.0)

        setpoint = await self._calculate_setpoint(current_soc, current_price, current_demand)

        return setpoint

    async def _calculate_setpoint(
        self,
        current_soc: float,
        current_price: Dict[str, Any],
        current_demand: float
    ) -> Dict[str, Any]:
        """Calculate optimal setpoint for current conditions"""
        buy_price = current_price.get('buy', 0.0)
        sell_price = current_price.get('sell', 0.0)

        # Check active schedules
        now = datetime.now()
        active = [s for s in self.active_schedules if s.start_time <= now < s.end_time]

        if active:
            # Follow active schedule
            schedule = active[0]
            return {
                'power': schedule.power_setpoint,
                'mode': schedule.schedule_type.value,
                'reason': f'Following schedule {schedule.id}'
            }

        # No active schedule - use real-time optimization
        avg_price = self.get_belief('average_price', buy_price)

        if buy_price < avg_price * 0.8 and current_soc < self.constraints.max_soc:
            # Low price - charge
            return {
                'power': self._calculate_available_charge_power(current_soc),
                'mode': 'charge',
                'reason': f'Low price ({buy_price:.2f} < {avg_price * 0.8:.2f})'
            }
        elif sell_price > avg_price * 1.2 and current_soc > self.constraints.min_soc:
            # High price - discharge
            return {
                'power': -self._calculate_available_discharge_power(current_soc),
                'mode': 'discharge',
                'reason': f'High price ({sell_price:.2f} > {avg_price * 1.2:.2f})'
            }
        else:
            # Hold
            return {
                'power': 0,
                'mode': 'idle',
                'reason': 'Prices within normal range'
            }

    async def _scan_arbitrage(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Scan for arbitrage opportunities"""
        if len(self.price_forecasts) < 2:
            return {'success': False, 'error': 'Insufficient price data'}

        prices = [p.buy_price for p in self.price_forecasts]

        min_price = min(prices)
        max_price = max(prices)
        spread = max_price - min_price
        spread_pct = spread / min_price * 100 if min_price > 0 else 0

        # Calculate potential profit
        efficiency = 0.9  # Round-trip efficiency
        potential_profit = spread * efficiency - min_price * (1 - efficiency)

        opportunities = []
        if spread_pct > 20:  # Significant spread
            opportunities.append({
                'type': 'temporal_arbitrage',
                'buy_price': min_price,
                'sell_price': max_price,
                'spread': spread,
                'spread_pct': spread_pct,
                'estimated_profit_per_kwh': potential_profit
            })

        return {
            'success': True,
            'opportunities': opportunities,
            'price_range': {'min': min_price, 'max': max_price, 'spread': spread}
        }

    async def _update_schedule(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Update active schedules"""
        now = datetime.now()

        # Move pending schedules to active if their time has come
        newly_active = []
        still_pending = []

        for schedule in self.pending_schedules:
            if schedule.start_time <= now:
                self.active_schedules.append(schedule)
                newly_active.append(schedule)
            else:
                still_pending.append(schedule)

        self.pending_schedules = still_pending

        # Remove expired active schedules
        self.active_schedules = [s for s in self.active_schedules if s.end_time > now]

        return {
            'success': True,
            'newly_active': len(newly_active),
            'active_count': len(self.active_schedules),
            'pending_count': len(self.pending_schedules)
        }

    def _should_reoptimize(self, price_signal: PriceSignal) -> bool:
        """Check if price change warrants re-optimization"""
        current = self.get_belief('current_price', {})
        if not current:
            return False

        prev_buy = current.get('buy', 0)
        change_pct = abs(price_signal.buy_price - prev_buy) / prev_buy * 100 if prev_buy > 0 else 0

        return change_pct > 10  # Re-optimize if price changed > 10%

    def _get_price_profile(self, n_steps: int) -> List[float]:
        """Get price profile for optimization horizon"""
        if not self.price_forecasts:
            return [0.10] * n_steps  # Default price

        prices = [p.buy_price for p in sorted(self.price_forecasts, key=lambda x: x.timestamp)]

        # Extend if needed
        while len(prices) < n_steps:
            prices.append(prices[-1] if prices else 0.10)

        return prices[:n_steps]

    def _get_load_profile(self, n_steps: int) -> List[float]:
        """Get load profile for optimization horizon"""
        if not self.load_forecasts:
            return []

        sorted_loads = sorted(self.load_forecasts.items(), key=lambda x: x[0])
        loads = [v for k, v in sorted_loads]

        while len(loads) < n_steps:
            loads.append(loads[-1] if loads else 0)

        return loads[:n_steps]

    def _get_generation_profile(self, n_steps: int) -> List[float]:
        """Get generation profile for optimization horizon"""
        if not self.generation_forecasts:
            return [0] * n_steps

        sorted_gen = sorted(self.generation_forecasts.items(), key=lambda x: x[0])
        gen = [v for k, v in sorted_gen]

        while len(gen) < n_steps:
            gen.append(0)

        return gen[:n_steps]

    def _calculate_available_charge_power(self, current_soc: float) -> float:
        """Calculate available charge power given current SOC"""
        max_power = self.get_belief('max_power_kw', 500.0)
        capacity = self.get_belief('battery_capacity_kwh', 1000.0)

        # Limit by SOC headroom
        soc_headroom = self.constraints.max_soc - current_soc
        max_by_soc = soc_headroom * capacity / (self.time_step_minutes / 60)

        return min(max_power * self.constraints.max_charge_rate, max_by_soc)

    def _calculate_available_discharge_power(self, current_soc: float) -> float:
        """Calculate available discharge power given current SOC"""
        max_power = self.get_belief('max_power_kw', 500.0)
        capacity = self.get_belief('battery_capacity_kwh', 1000.0)

        # Limit by SOC floor
        soc_available = current_soc - self.constraints.min_soc
        max_by_soc = soc_available * capacity / (self.time_step_minutes / 60)

        return min(max_power * self.constraints.max_discharge_rate, max_by_soc)

    def _calculate_outcomes(
        self,
        schedules: List[Schedule],
        price_profile: List[float],
        capacity: float
    ) -> Tuple[float, float, float]:
        """Calculate expected revenue, cost, and degradation"""
        total_revenue = 0.0
        total_cost = 0.0
        total_energy_throughput = 0.0

        for schedule in schedules:
            energy = abs(schedule.power_setpoint) * (self.time_step_minutes / 60)
            total_energy_throughput += energy

            if schedule.power_setpoint > 0:  # Charging
                total_cost += schedule.estimated_revenue if schedule.estimated_revenue < 0 else energy * 0.10
            else:  # Discharging
                total_revenue += schedule.estimated_revenue if schedule.estimated_revenue > 0 else energy * 0.15

        # Estimate degradation (simplified model)
        cycles = total_energy_throughput / (2 * capacity) if capacity > 0 else 0
        degradation = cycles * 0.0001  # 0.01% per cycle

        return total_revenue, total_cost, degradation

    def _check_constraints(self, schedules: List[Schedule], constraints: OptimizationConstraints) -> bool:
        """Check if schedules satisfy constraints"""
        for schedule in schedules:
            power = abs(schedule.power_setpoint)
            max_power = self.get_belief('max_power_kw', 500.0)

            if schedule.power_setpoint > 0:  # Charging
                if power > max_power * constraints.max_charge_rate:
                    return False
            else:  # Discharging
                if power > max_power * constraints.max_discharge_rate:
                    return False

        return True

    def _schedule_to_dict(self, schedule: Schedule) -> Dict[str, Any]:
        """Convert schedule to dictionary"""
        return {
            'id': schedule.id,
            'start_time': schedule.start_time.isoformat(),
            'end_time': schedule.end_time.isoformat(),
            'type': schedule.schedule_type.value,
            'power_setpoint_kw': schedule.power_setpoint,
            'target_soc': schedule.target_soc,
            'objective': schedule.objective.value,
            'estimated_revenue': schedule.estimated_revenue
        }

    def get_optimization_status(self) -> Dict[str, Any]:
        """Get current optimization status"""
        return {
            'agent_id': self.agent_id,
            'state': self.state.value,
            'active_schedules': len(self.active_schedules),
            'pending_schedules': len(self.pending_schedules),
            'price_forecasts': len(self.price_forecasts),
            'load_forecasts': len(self.load_forecasts),
            'constraints': {
                'min_soc': self.constraints.min_soc,
                'max_soc': self.constraints.max_soc,
                'max_charge_rate': self.constraints.max_charge_rate,
                'max_discharge_rate': self.constraints.max_discharge_rate
            },
            'last_optimization': self.optimization_history[-1].optimization_time_ms if self.optimization_history else None
        }
