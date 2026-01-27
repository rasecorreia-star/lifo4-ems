"""
Reward Calculator for BESS Reinforcement Learning
Implements multi-objective reward functions with configurable weights.
"""

import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class RewardComponent(Enum):
    """Individual reward components"""
    ARBITRAGE = "arbitrage"
    PEAK_SHAVING = "peak_shaving"
    SELF_CONSUMPTION = "self_consumption"
    GRID_SUPPORT = "grid_support"
    DEGRADATION = "degradation"
    SOC_BOUNDS = "soc_bounds"
    TEMPERATURE = "temperature"
    EFFICIENCY = "efficiency"
    CARBON = "carbon"
    DEMAND_RESPONSE = "demand_response"


@dataclass
class RewardWeights:
    """Configurable weights for reward components"""
    arbitrage: float = 1.0
    peak_shaving: float = 0.5
    self_consumption: float = 0.3
    grid_support: float = 0.2
    degradation: float = -0.5
    soc_bounds: float = -0.3
    temperature: float = -0.2
    efficiency: float = 0.1
    carbon: float = 0.2
    demand_response: float = 0.4

    def to_dict(self) -> Dict[str, float]:
        return {
            'arbitrage': self.arbitrage,
            'peak_shaving': self.peak_shaving,
            'self_consumption': self.self_consumption,
            'grid_support': self.grid_support,
            'degradation': self.degradation,
            'soc_bounds': self.soc_bounds,
            'temperature': self.temperature,
            'efficiency': self.efficiency,
            'carbon': self.carbon,
            'demand_response': self.demand_response
        }

    @classmethod
    def from_dict(cls, data: Dict[str, float]) -> 'RewardWeights':
        return cls(**{k: v for k, v in data.items() if hasattr(cls, k)})

    @classmethod
    def economic_focus(cls) -> 'RewardWeights':
        """Preset focused on economic optimization"""
        return cls(
            arbitrage=2.0,
            peak_shaving=1.0,
            self_consumption=0.5,
            grid_support=0.3,
            degradation=-0.3,
            soc_bounds=-0.2,
            temperature=-0.1,
            efficiency=0.2,
            carbon=0.0,
            demand_response=0.8
        )

    @classmethod
    def battery_health_focus(cls) -> 'RewardWeights':
        """Preset focused on battery longevity"""
        return cls(
            arbitrage=0.5,
            peak_shaving=0.3,
            self_consumption=0.3,
            grid_support=0.1,
            degradation=-2.0,
            soc_bounds=-1.0,
            temperature=-1.0,
            efficiency=0.5,
            carbon=0.0,
            demand_response=0.2
        )

    @classmethod
    def sustainability_focus(cls) -> 'RewardWeights':
        """Preset focused on sustainability"""
        return cls(
            arbitrage=0.3,
            peak_shaving=0.5,
            self_consumption=1.5,
            grid_support=0.5,
            degradation=-0.3,
            soc_bounds=-0.2,
            temperature=-0.2,
            efficiency=0.3,
            carbon=2.0,
            demand_response=0.3
        )


@dataclass
class BESSContext:
    """Context information for reward calculation"""
    # Battery state
    soc: float  # State of charge (0-100)
    soh: float  # State of health (0-100)
    temperature: float  # Temperature (C)
    power: float  # Current power (kW, positive=discharge)
    capacity_kwh: float  # Battery capacity

    # Time and pricing
    hour: int  # Hour of day
    price: float  # Current price ($/kWh)
    price_forecast: Optional[List[float]] = None

    # Load and generation
    load: float = 0.0  # Load demand (kW)
    solar: float = 0.0  # Solar generation (kW)
    wind: float = 0.0  # Wind generation (kW)

    # Grid conditions
    grid_frequency: float = 60.0  # Hz
    grid_voltage: float = 1.0  # p.u.
    carbon_intensity: float = 0.4  # kg CO2/kWh

    # Peak demand
    peak_demand: float = 0.0
    demand_target: float = 100.0

    # Demand response
    dr_event_active: bool = False
    dr_target_reduction: float = 0.0


@dataclass
class RewardBreakdown:
    """Detailed breakdown of reward calculation"""
    total_reward: float
    components: Dict[str, float]
    weighted_components: Dict[str, float]
    context_summary: Dict[str, Any]
    timestamp: str = field(default_factory=lambda: str(np.datetime64('now')))

    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_reward': self.total_reward,
            'components': self.components,
            'weighted_components': self.weighted_components,
            'context_summary': self.context_summary,
            'timestamp': self.timestamp
        }


class RewardCalculator:
    """
    Multi-objective reward calculator for BESS control.
    Supports various reward components with configurable weights.
    """

    def __init__(self, weights: Optional[RewardWeights] = None):
        self.weights = weights or RewardWeights()
        self.history: List[RewardBreakdown] = []
        self.running_stats = {
            'mean_reward': 0.0,
            'count': 0
        }

    def calculate(
        self,
        context: BESSContext,
        action_power: float
    ) -> Tuple[float, RewardBreakdown]:
        """
        Calculate reward for given context and action.

        Args:
            context: Current BESS context
            action_power: Power action taken (kW, positive=discharge)

        Returns:
            Tuple of (total_reward, breakdown)
        """
        components = {}
        weighted_components = {}

        # 1. Arbitrage reward
        arbitrage = self._calculate_arbitrage(context, action_power)
        components['arbitrage'] = arbitrage
        weighted_components['arbitrage'] = arbitrage * self.weights.arbitrage

        # 2. Peak shaving reward
        peak_shaving = self._calculate_peak_shaving(context, action_power)
        components['peak_shaving'] = peak_shaving
        weighted_components['peak_shaving'] = peak_shaving * self.weights.peak_shaving

        # 3. Self-consumption reward
        self_consumption = self._calculate_self_consumption(context, action_power)
        components['self_consumption'] = self_consumption
        weighted_components['self_consumption'] = self_consumption * self.weights.self_consumption

        # 4. Grid support reward
        grid_support = self._calculate_grid_support(context, action_power)
        components['grid_support'] = grid_support
        weighted_components['grid_support'] = grid_support * self.weights.grid_support

        # 5. Degradation penalty
        degradation = self._calculate_degradation(context, action_power)
        components['degradation'] = degradation
        weighted_components['degradation'] = degradation * self.weights.degradation

        # 6. SOC bounds penalty
        soc_bounds = self._calculate_soc_bounds(context)
        components['soc_bounds'] = soc_bounds
        weighted_components['soc_bounds'] = soc_bounds * self.weights.soc_bounds

        # 7. Temperature penalty
        temperature = self._calculate_temperature(context)
        components['temperature'] = temperature
        weighted_components['temperature'] = temperature * self.weights.temperature

        # 8. Efficiency reward
        efficiency = self._calculate_efficiency(context, action_power)
        components['efficiency'] = efficiency
        weighted_components['efficiency'] = efficiency * self.weights.efficiency

        # 9. Carbon reward
        carbon = self._calculate_carbon(context, action_power)
        components['carbon'] = carbon
        weighted_components['carbon'] = carbon * self.weights.carbon

        # 10. Demand response reward
        demand_response = self._calculate_demand_response(context, action_power)
        components['demand_response'] = demand_response
        weighted_components['demand_response'] = demand_response * self.weights.demand_response

        # Total weighted reward
        total_reward = sum(weighted_components.values())

        # Create breakdown
        breakdown = RewardBreakdown(
            total_reward=total_reward,
            components=components,
            weighted_components=weighted_components,
            context_summary={
                'soc': context.soc,
                'power': action_power,
                'price': context.price,
                'load': context.load,
                'solar': context.solar,
                'hour': context.hour
            }
        )

        # Update history and stats
        self.history.append(breakdown)
        self._update_running_stats(total_reward)

        return total_reward, breakdown

    def _calculate_arbitrage(self, context: BESSContext, power: float) -> float:
        """
        Calculate arbitrage reward.
        Positive for selling at high price, negative for buying at low price.
        """
        # Normalize price (assume typical range 0.05-0.30 $/kWh)
        price_normalized = (context.price - 0.15) / 0.15

        if power > 0:  # Discharge = selling
            return power * price_normalized * 0.1
        else:  # Charge = buying
            return power * price_normalized * 0.1  # Negative power, so subtracts when price high

    def _calculate_peak_shaving(self, context: BESSContext, power: float) -> float:
        """
        Calculate peak shaving reward.
        Reward for reducing peak demand.
        """
        net_load = context.load - context.solar - context.wind

        # Reward for discharging during high load
        if power > 0 and net_load > context.demand_target * 0.8:
            reduction = min(power, net_load - context.demand_target * 0.7)
            return reduction / context.demand_target * 0.5

        # Penalty for discharging during low load (wasting opportunity)
        if power > 0 and net_load < context.demand_target * 0.3:
            return -0.1

        return 0.0

    def _calculate_self_consumption(self, context: BESSContext, power: float) -> float:
        """
        Calculate self-consumption reward.
        Reward for storing excess renewable generation.
        """
        total_renewable = context.solar + context.wind
        excess_renewable = max(0, total_renewable - context.load)

        if power < 0 and excess_renewable > 0:  # Charging during excess
            stored_renewable = min(abs(power), excess_renewable)
            return stored_renewable / context.capacity_kwh * 10

        return 0.0

    def _calculate_grid_support(self, context: BESSContext, power: float) -> float:
        """
        Calculate grid support reward.
        Reward for frequency regulation and voltage support.
        """
        reward = 0.0

        # Frequency regulation
        freq_deviation = abs(context.grid_frequency - 60.0)
        if freq_deviation > 0.02:  # Dead band
            if (context.grid_frequency < 60.0 and power > 0) or \
               (context.grid_frequency > 60.0 and power < 0):
                reward += abs(power) * freq_deviation * 10

        # Voltage support
        voltage_deviation = abs(context.grid_voltage - 1.0)
        if voltage_deviation > 0.02:
            reward += abs(power) * voltage_deviation * 5

        return reward

    def _calculate_degradation(self, context: BESSContext, power: float) -> float:
        """
        Calculate degradation penalty.
        Based on cycle depth and C-rate.
        """
        # C-rate factor (higher C-rate = more degradation)
        c_rate = abs(power) / context.capacity_kwh
        c_rate_factor = 1 + (c_rate - 0.5) ** 2 if c_rate > 0.5 else 1

        # SOC stress factor (extreme SOC = more degradation)
        soc_stress = 0.0
        if context.soc < 20:
            soc_stress = (20 - context.soc) / 20
        elif context.soc > 80:
            soc_stress = (context.soc - 80) / 20

        # Temperature stress
        temp_stress = 0.0
        if context.temperature > 35:
            temp_stress = (context.temperature - 35) / 25
        elif context.temperature < 15:
            temp_stress = (15 - context.temperature) / 25

        # Base degradation per kWh throughput
        base_degradation = abs(power) / context.capacity_kwh * 0.001

        return base_degradation * c_rate_factor * (1 + soc_stress + temp_stress)

    def _calculate_soc_bounds(self, context: BESSContext) -> float:
        """
        Calculate SOC bounds penalty.
        Penalize operation near limits.
        """
        if context.soc < 10:
            return (10 - context.soc) / 10
        elif context.soc > 95:
            return (context.soc - 95) / 5
        elif context.soc < 20:
            return (20 - context.soc) / 20 * 0.5
        elif context.soc > 90:
            return (context.soc - 90) / 10 * 0.5
        return 0.0

    def _calculate_temperature(self, context: BESSContext) -> float:
        """
        Calculate temperature penalty.
        Penalize operation outside optimal range.
        """
        optimal_min = 20
        optimal_max = 35

        if context.temperature < optimal_min:
            return (optimal_min - context.temperature) / 20
        elif context.temperature > optimal_max:
            return (context.temperature - optimal_max) / 15 * 2  # Higher penalty for heat

        return 0.0

    def _calculate_efficiency(self, context: BESSContext, power: float) -> float:
        """
        Calculate efficiency reward.
        Reward for operating at efficient power levels.
        """
        if abs(power) < 0.01:  # Idle
            return 0.0

        # Optimal efficiency typically at 20-80% of rated power
        power_ratio = abs(power) / context.capacity_kwh
        if 0.2 <= power_ratio <= 0.8:
            return 0.1
        elif power_ratio < 0.1 or power_ratio > 0.95:
            return -0.05

        return 0.0

    def _calculate_carbon(self, context: BESSContext, power: float) -> float:
        """
        Calculate carbon reward.
        Reward for reducing carbon emissions.
        """
        # Charging during low carbon intensity
        if power < 0 and context.carbon_intensity < 0.3:
            return abs(power) * (0.5 - context.carbon_intensity) * 0.1

        # Discharging during high carbon intensity
        if power > 0 and context.carbon_intensity > 0.5:
            return power * (context.carbon_intensity - 0.3) * 0.1

        return 0.0

    def _calculate_demand_response(self, context: BESSContext, power: float) -> float:
        """
        Calculate demand response reward.
        Reward for participating in DR events.
        """
        if not context.dr_event_active:
            return 0.0

        if power > 0:  # Discharging during DR event
            contribution = min(power, context.dr_target_reduction)
            return contribution / context.dr_target_reduction * 2

        return -0.5  # Penalty for charging during DR event

    def _update_running_stats(self, reward: float):
        """Update running statistics"""
        n = self.running_stats['count']
        old_mean = self.running_stats['mean_reward']
        self.running_stats['count'] = n + 1
        self.running_stats['mean_reward'] = old_mean + (reward - old_mean) / (n + 1)

    def update_weights(self, new_weights: Dict[str, float]):
        """Update reward weights"""
        for key, value in new_weights.items():
            if hasattr(self.weights, key):
                setattr(self.weights, key, value)

    def get_statistics(self) -> Dict[str, Any]:
        """Get reward statistics"""
        if not self.history:
            return {'message': 'No history available'}

        rewards = [h.total_reward for h in self.history]
        return {
            'mean_reward': np.mean(rewards),
            'std_reward': np.std(rewards),
            'min_reward': np.min(rewards),
            'max_reward': np.max(rewards),
            'total_calculations': len(self.history),
            'running_mean': self.running_stats['mean_reward']
        }

    def get_component_analysis(self) -> Dict[str, Dict[str, float]]:
        """Analyze contribution of each component"""
        if not self.history:
            return {}

        analysis = {}
        for component in RewardComponent:
            name = component.value
            values = [h.weighted_components.get(name, 0) for h in self.history]
            analysis[name] = {
                'mean': np.mean(values),
                'std': np.std(values),
                'contribution_percent': abs(np.mean(values)) / max(abs(self.running_stats['mean_reward']), 1e-6) * 100
            }

        return analysis

    def reset_history(self):
        """Reset calculation history"""
        self.history = []
        self.running_stats = {'mean_reward': 0.0, 'count': 0}


# Utility functions
def create_reward_calculator(preset: str = 'default') -> RewardCalculator:
    """Create reward calculator with preset weights"""
    presets = {
        'default': RewardWeights(),
        'economic': RewardWeights.economic_focus(),
        'health': RewardWeights.battery_health_focus(),
        'sustainable': RewardWeights.sustainability_focus()
    }
    weights = presets.get(preset, RewardWeights())
    return RewardCalculator(weights)
