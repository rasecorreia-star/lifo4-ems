"""
Config Optimizer
Real-time configuration optimization based on current conditions.
"""

import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OptimizationObjective(Enum):
    """Optimization objectives"""
    EFFICIENCY = "efficiency"
    LONGEVITY = "longevity"
    REVENUE = "revenue"
    SAFETY = "safety"
    BALANCED = "balanced"


@dataclass
class OperatingConditions:
    """Current operating conditions"""
    ambient_temperature: float
    soc: float
    soh: float
    load_profile: str  # "peak", "off_peak", "stable", "variable"
    energy_price: float
    time_of_day: int  # hour 0-23
    grid_demand: str  # "high", "medium", "low"


@dataclass
class OptimizationResult:
    """Result of configuration optimization"""
    success: bool
    optimized_parameters: Dict[str, float]
    expected_improvement: float
    objective_scores: Dict[str, float]
    recommendations: List[str]
    conditions_considered: Dict[str, Any]


class ConfigOptimizer:
    """
    Real-time configuration optimizer.

    Optimizes parameters based on:
    - Current operating conditions
    - Historical performance data
    - Multi-objective optimization
    """

    def __init__(self):
        # Optimization weights for different objectives
        self.objective_weights = {
            OptimizationObjective.EFFICIENCY: {
                'efficiency': 1.0, 'longevity': 0.3, 'revenue': 0.5, 'safety': 0.8
            },
            OptimizationObjective.LONGEVITY: {
                'efficiency': 0.5, 'longevity': 1.0, 'revenue': 0.3, 'safety': 0.9
            },
            OptimizationObjective.REVENUE: {
                'efficiency': 0.6, 'longevity': 0.4, 'revenue': 1.0, 'safety': 0.7
            },
            OptimizationObjective.SAFETY: {
                'efficiency': 0.3, 'longevity': 0.5, 'revenue': 0.2, 'safety': 1.0
            },
            OptimizationObjective.BALANCED: {
                'efficiency': 0.7, 'longevity': 0.7, 'revenue': 0.7, 'safety': 0.9
            }
        }

        # Condition-based adjustments
        self.temperature_adjustments = self._build_temperature_adjustments()
        self.soc_adjustments = self._build_soc_adjustments()
        self.load_adjustments = self._build_load_adjustments()

    def _build_temperature_adjustments(self) -> Dict[str, Dict[str, float]]:
        """Build temperature-based parameter adjustments"""
        return {
            'cold': {  # < 10°C
                'max_charge_current_c': 0.7,  # Reduce by 30%
                'max_discharge_current_c': 0.8,
                'target_temperature_c': 20
            },
            'cool': {  # 10-20°C
                'max_charge_current_c': 0.9,
                'max_discharge_current_c': 0.95,
                'target_temperature_c': 22
            },
            'optimal': {  # 20-30°C
                'max_charge_current_c': 1.0,
                'max_discharge_current_c': 1.0,
                'target_temperature_c': 25
            },
            'warm': {  # 30-40°C
                'max_charge_current_c': 0.85,
                'max_discharge_current_c': 0.9,
                'target_temperature_c': 28,
                'cooling_start_temperature_c': 32
            },
            'hot': {  # > 40°C
                'max_charge_current_c': 0.6,
                'max_discharge_current_c': 0.7,
                'cooling_start_temperature_c': 35
            }
        }

    def _build_soc_adjustments(self) -> Dict[str, Dict[str, float]]:
        """Build SOC-based parameter adjustments"""
        return {
            'low': {  # < 20%
                'max_discharge_current_c': 0.5,
                'low_voltage_warning': 2.9
            },
            'medium_low': {  # 20-40%
                'max_discharge_current_c': 0.8,
                'balance_delta_mv': 15
            },
            'medium': {  # 40-60%
                'max_charge_current_c': 1.0,
                'max_discharge_current_c': 1.0
            },
            'medium_high': {  # 60-80%
                'max_charge_current_c': 0.9,
                'balance_delta_mv': 10
            },
            'high': {  # > 80%
                'max_charge_current_c': 0.7,
                'bulk_charge_voltage_per_cell': 3.60
            }
        }

    def _build_load_adjustments(self) -> Dict[str, Dict[str, float]]:
        """Build load profile adjustments"""
        return {
            'peak': {
                'max_discharge_current_c': 1.2,  # Allow higher discharge
                'min_cell_voltage': 2.6  # Allow deeper discharge
            },
            'off_peak': {
                'max_charge_current_c': 1.1,  # Faster charging
                'target_temperature_c': 23
            },
            'stable': {
                'max_charge_current_c': 1.0,
                'max_discharge_current_c': 1.0
            },
            'variable': {
                'max_charge_current_c': 0.9,  # More conservative
                'max_discharge_current_c': 0.9,
                'balance_delta_mv': 8
            }
        }

    def optimize(
        self,
        base_config: Dict[str, float],
        conditions: OperatingConditions,
        objective: OptimizationObjective = OptimizationObjective.BALANCED
    ) -> OptimizationResult:
        """
        Optimize configuration for current conditions.

        Args:
            base_config: Base configuration parameters
            conditions: Current operating conditions
            objective: Optimization objective

        Returns:
            OptimizationResult with optimized parameters
        """
        optimized = base_config.copy()
        recommendations = []

        # Apply temperature adjustments
        temp_zone = self._get_temperature_zone(conditions.ambient_temperature)
        temp_adj = self.temperature_adjustments.get(temp_zone, {})

        for param, factor in temp_adj.items():
            if param in optimized:
                if factor < 1.0:  # Multiplicative factor
                    optimized[param] = optimized[param] * factor
                else:  # Absolute value
                    optimized[param] = factor

        if temp_zone in ['cold', 'hot']:
            recommendations.append(
                f"Temperature is {temp_zone} ({conditions.ambient_temperature}°C). "
                f"Reduced charge/discharge rates for safety."
            )

        # Apply SOC adjustments
        soc_zone = self._get_soc_zone(conditions.soc)
        soc_adj = self.soc_adjustments.get(soc_zone, {})

        for param, value in soc_adj.items():
            if param in optimized:
                if value < 2.0:  # Multiplicative factor
                    optimized[param] = optimized[param] * value
                else:  # Absolute value
                    optimized[param] = value

        if soc_zone in ['low', 'high']:
            recommendations.append(
                f"SOC is {soc_zone} ({conditions.soc:.1f}%). "
                f"Adjusted rates to protect battery."
            )

        # Apply load adjustments
        load_adj = self.load_adjustments.get(conditions.load_profile, {})
        for param, value in load_adj.items():
            if param in optimized:
                if value < 2.0:
                    optimized[param] = optimized[param] * value
                else:
                    optimized[param] = value

        # Apply objective-specific optimizations
        weights = self.objective_weights[objective]

        if weights['revenue'] > 0.8 and conditions.energy_price > 100:
            recommendations.append(
                f"High energy price (R${conditions.energy_price}/MWh). "
                f"Prioritizing discharge for revenue."
            )
            optimized['max_discharge_current_c'] = min(
                optimized.get('max_discharge_current_c', 1.0) * 1.1,
                1.5
            )

        if weights['longevity'] > 0.8:
            # More conservative for battery life
            optimized['max_charge_current_c'] = min(
                optimized.get('max_charge_current_c', 1.0),
                0.7
            )
            optimized['max_discharge_current_c'] = min(
                optimized.get('max_discharge_current_c', 1.0),
                0.8
            )
            recommendations.append("Prioritizing battery longevity with conservative rates.")

        if weights['safety'] > 0.9:
            # Extra safety margins
            optimized['overvoltage_protection_v'] = optimized.get('overvoltage_protection_v', 3.7) - 0.05
            optimized['overtemperature_protection_c'] = optimized.get('overtemperature_protection_c', 60) - 5
            recommendations.append("Enhanced safety margins applied.")

        # Calculate objective scores
        objective_scores = self._calculate_scores(optimized, conditions)

        # Calculate expected improvement
        base_score = sum(
            weights.get(k, 0) * self._estimate_metric(base_config, k, conditions)
            for k in weights
        )
        opt_score = sum(
            weights.get(k, 0) * self._estimate_metric(optimized, k, conditions)
            for k in weights
        )

        improvement = (opt_score - base_score) / max(base_score, 0.001)

        return OptimizationResult(
            success=True,
            optimized_parameters=optimized,
            expected_improvement=improvement,
            objective_scores=objective_scores,
            recommendations=recommendations,
            conditions_considered={
                'temperature_zone': temp_zone,
                'soc_zone': soc_zone,
                'load_profile': conditions.load_profile,
                'objective': objective.value
            }
        )

    def _get_temperature_zone(self, temp: float) -> str:
        """Get temperature zone"""
        if temp < 10:
            return 'cold'
        elif temp < 20:
            return 'cool'
        elif temp < 30:
            return 'optimal'
        elif temp < 40:
            return 'warm'
        else:
            return 'hot'

    def _get_soc_zone(self, soc: float) -> str:
        """Get SOC zone"""
        if soc < 20:
            return 'low'
        elif soc < 40:
            return 'medium_low'
        elif soc < 60:
            return 'medium'
        elif soc < 80:
            return 'medium_high'
        else:
            return 'high'

    def _calculate_scores(
        self,
        config: Dict[str, float],
        conditions: OperatingConditions
    ) -> Dict[str, float]:
        """Calculate objective scores"""
        return {
            'efficiency': self._estimate_metric(config, 'efficiency', conditions),
            'longevity': self._estimate_metric(config, 'longevity', conditions),
            'revenue': self._estimate_metric(config, 'revenue', conditions),
            'safety': self._estimate_metric(config, 'safety', conditions)
        }

    def _estimate_metric(
        self,
        config: Dict[str, float],
        metric: str,
        conditions: OperatingConditions
    ) -> float:
        """Estimate a metric value based on config and conditions"""
        if metric == 'efficiency':
            base = 0.92
            # Higher C-rate reduces efficiency
            c_rate = config.get('max_charge_current_c', 1.0)
            base -= (c_rate - 0.5) * 0.02
            # Temperature affects efficiency
            if conditions.ambient_temperature < 15 or conditions.ambient_temperature > 35:
                base -= 0.02
            return max(0.85, min(0.98, base))

        elif metric == 'longevity':
            base = 0.95
            # Higher C-rate reduces life
            c_rate = max(
                config.get('max_charge_current_c', 1.0),
                config.get('max_discharge_current_c', 1.0)
            )
            base -= (c_rate - 0.5) * 0.05
            # SOH affects score
            base *= conditions.soh / 100
            return max(0.5, min(1.0, base))

        elif metric == 'revenue':
            base = 0.5
            # Higher discharge rate during high prices is good
            if conditions.energy_price > 100:
                base += config.get('max_discharge_current_c', 1.0) * 0.2
            # Higher charge rate during low prices is good
            if conditions.energy_price < 50:
                base += config.get('max_charge_current_c', 1.0) * 0.1
            return max(0.3, min(1.0, base))

        elif metric == 'safety':
            base = 0.9
            # Conservative settings are safer
            if config.get('max_charge_current_c', 1.0) <= 0.7:
                base += 0.05
            if config.get('max_discharge_current_c', 1.0) <= 0.8:
                base += 0.03
            # Temperature extremes reduce safety score
            if conditions.ambient_temperature < 5 or conditions.ambient_temperature > 45:
                base -= 0.1
            return max(0.7, min(1.0, base))

        return 0.5

    def get_recommendation(
        self,
        conditions: OperatingConditions,
        current_config: Dict[str, float]
    ) -> List[str]:
        """Get recommendations based on conditions"""
        recommendations = []

        # Temperature recommendations
        if conditions.ambient_temperature > 40:
            recommendations.append(
                "High ambient temperature detected. Consider activating emergency cooling."
            )
        elif conditions.ambient_temperature < 5:
            recommendations.append(
                "Low ambient temperature detected. Pre-heating recommended before charging."
            )

        # SOC recommendations
        if conditions.soc < 10:
            recommendations.append(
                "Critical low SOC. Prioritize charging immediately."
            )
        elif conditions.soc > 95:
            recommendations.append(
                "SOC very high. Consider reducing to 90% for longevity."
            )

        # Price recommendations
        if conditions.energy_price > 200:
            recommendations.append(
                f"Very high energy price (R${conditions.energy_price}/MWh). "
                "Maximize discharge for revenue."
            )
        elif conditions.energy_price < 30:
            recommendations.append(
                f"Low energy price (R${conditions.energy_price}/MWh). "
                "Good opportunity for charging."
            )

        # Grid demand recommendations
        if conditions.grid_demand == 'high':
            recommendations.append(
                "High grid demand. Consider providing ancillary services."
            )

        return recommendations
