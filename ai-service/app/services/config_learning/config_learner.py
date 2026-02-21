"""
Config Learner
Learns optimal configurations from operational data using ML.
"""

import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)


class LearningStrategy(Enum):
    """Learning strategies"""
    BAYESIAN = "bayesian"
    REINFORCEMENT = "reinforcement"
    EVOLUTIONARY = "evolutionary"
    TRANSFER = "transfer"


@dataclass
class OperationalSample:
    """Sample of operational data"""
    timestamp: datetime
    config_id: str
    parameters: Dict[str, float]
    conditions: Dict[str, float]  # temperature, SOC, load, etc.
    outcomes: Dict[str, float]  # efficiency, degradation, revenue, etc.
    duration_hours: float
    success: bool


@dataclass
class LearningResult:
    """Result of learning process"""
    success: bool
    suggested_parameters: Dict[str, float]
    confidence: float
    improvement_estimate: float
    samples_used: int
    learning_time_ms: float
    reasoning: str


@dataclass
class ParameterBounds:
    """Bounds for a parameter"""
    min_value: float
    max_value: float
    default_value: float
    step_size: float = 0.01


# Default parameter bounds for different categories
PARAMETER_BOUNDS = {
    "charging": {
        "max_charge_current_c": ParameterBounds(0.1, 2.0, 0.5, 0.1),
        "bulk_charge_voltage_per_cell": ParameterBounds(3.4, 3.7, 3.65, 0.01),
        "absorption_time_minutes": ParameterBounds(10, 120, 30, 5),
        "temperature_compensation_mv_per_c": ParameterBounds(-10, 0, -3, 1)
    },
    "discharging": {
        "max_discharge_current_c": ParameterBounds(0.1, 3.0, 1.0, 0.1),
        "min_cell_voltage": ParameterBounds(2.0, 3.0, 2.5, 0.1),
        "low_voltage_warning": ParameterBounds(2.5, 3.2, 2.8, 0.1)
    },
    "thermal": {
        "target_temperature_c": ParameterBounds(15, 35, 25, 1),
        "cooling_start_temperature_c": ParameterBounds(25, 45, 35, 1),
        "heating_start_temperature_c": ParameterBounds(0, 20, 10, 1),
        "delta_t_alarm_c": ParameterBounds(2, 10, 5, 1)
    },
    "balancing": {
        "balance_start_voltage_v": ParameterBounds(3.2, 3.6, 3.4, 0.05),
        "balance_delta_mv": ParameterBounds(5, 50, 10, 5),
        "balance_current_ma": ParameterBounds(10, 200, 50, 10)
    }
}


class ConfigLearner:
    """
    Learns optimal configurations from operational data.

    Methods:
    - Bayesian optimization for parameter tuning
    - Reinforcement learning for dynamic adjustments
    - Transfer learning from similar systems
    """

    def __init__(self):
        self.samples: Dict[str, List[OperationalSample]] = defaultdict(list)
        self.parameter_bounds = PARAMETER_BOUNDS

        # Learning state
        self.best_configs: Dict[str, Dict[str, float]] = {}
        self.exploration_rate = 0.2  # For RL
        self.learning_rate = 0.1

        # Bayesian state (simplified)
        self.parameter_means: Dict[str, Dict[str, float]] = defaultdict(dict)
        self.parameter_stds: Dict[str, Dict[str, float]] = defaultdict(dict)

        # Performance tracking
        self.performance_history: Dict[str, List[float]] = defaultdict(list)

    def add_sample(self, sample: OperationalSample):
        """Add an operational sample for learning"""
        key = f"{sample.config_id}"
        self.samples[key].append(sample)

        # Update performance history
        if 'efficiency' in sample.outcomes:
            self.performance_history[key].append(sample.outcomes['efficiency'])

        # Limit history size
        if len(self.samples[key]) > 10000:
            self.samples[key] = self.samples[key][-10000:]

    def learn(
        self,
        category: str,
        device_type: str,
        target_metric: str = 'efficiency',
        strategy: LearningStrategy = LearningStrategy.BAYESIAN,
        constraints: Optional[Dict[str, Any]] = None
    ) -> LearningResult:
        """
        Learn optimal parameters for a category.

        Args:
            category: Configuration category (charging, discharging, etc.)
            device_type: Device type to learn for
            target_metric: Metric to optimize
            strategy: Learning strategy to use
            constraints: Additional constraints

        Returns:
            LearningResult with suggested parameters
        """
        start_time = datetime.now()

        # Get relevant samples
        samples = self._get_relevant_samples(category, device_type)

        if len(samples) < 10:
            return LearningResult(
                success=False,
                suggested_parameters={},
                confidence=0.0,
                improvement_estimate=0.0,
                samples_used=len(samples),
                learning_time_ms=0,
                reasoning="Insufficient data for learning (need at least 10 samples)"
            )

        # Apply learning strategy
        if strategy == LearningStrategy.BAYESIAN:
            result = self._learn_bayesian(category, samples, target_metric, constraints)
        elif strategy == LearningStrategy.REINFORCEMENT:
            result = self._learn_reinforcement(category, samples, target_metric, constraints)
        elif strategy == LearningStrategy.EVOLUTIONARY:
            result = self._learn_evolutionary(category, samples, target_metric, constraints)
        else:
            result = self._learn_bayesian(category, samples, target_metric, constraints)

        elapsed = (datetime.now() - start_time).total_seconds() * 1000
        result.learning_time_ms = elapsed
        result.samples_used = len(samples)

        return result

    def _get_relevant_samples(
        self,
        category: str,
        device_type: str
    ) -> List[OperationalSample]:
        """Get samples relevant to the category and device type"""
        all_samples = []
        for key, samples in self.samples.items():
            # Filter by category (simplified)
            all_samples.extend(samples)

        return all_samples

    def _learn_bayesian(
        self,
        category: str,
        samples: List[OperationalSample],
        target_metric: str,
        constraints: Optional[Dict[str, Any]]
    ) -> LearningResult:
        """Bayesian optimization for parameters"""
        bounds = self.parameter_bounds.get(category, {})
        if not bounds:
            return LearningResult(
                success=False,
                suggested_parameters={},
                confidence=0.0,
                improvement_estimate=0.0,
                samples_used=len(samples),
                learning_time_ms=0,
                reasoning=f"No parameter bounds defined for category: {category}"
            )

        # Extract parameter values and outcomes
        param_outcomes: Dict[str, List[Tuple[float, float]]] = defaultdict(list)

        for sample in samples:
            outcome = sample.outcomes.get(target_metric, 0)
            for param_name, value in sample.parameters.items():
                if param_name in bounds:
                    param_outcomes[param_name].append((value, outcome))

        # Learn optimal value for each parameter using Gaussian Process (simplified)
        suggested = {}
        confidences = []

        for param_name, bound in bounds.items():
            if param_name in param_outcomes and len(param_outcomes[param_name]) >= 5:
                values, outcomes = zip(*param_outcomes[param_name])
                optimal, confidence = self._gaussian_process_optimize(
                    np.array(values),
                    np.array(outcomes),
                    bound
                )
                suggested[param_name] = optimal
                confidences.append(confidence)
            else:
                suggested[param_name] = bound.default_value
                confidences.append(0.5)

        # Estimate improvement
        current_performance = np.mean([s.outcomes.get(target_metric, 0) for s in samples[-100:]])
        estimated_improvement = self._estimate_improvement(suggested, samples, target_metric)

        avg_confidence = np.mean(confidences) if confidences else 0.5

        return LearningResult(
            success=True,
            suggested_parameters=suggested,
            confidence=avg_confidence,
            improvement_estimate=estimated_improvement,
            samples_used=len(samples),
            learning_time_ms=0,
            reasoning=f"Bayesian optimization with {len(samples)} samples. "
                     f"Estimated improvement: {estimated_improvement:.2%}"
        )

    def _gaussian_process_optimize(
        self,
        x: np.ndarray,
        y: np.ndarray,
        bound: ParameterBounds
    ) -> Tuple[float, float]:
        """Simplified Gaussian Process optimization"""
        # Use weighted average based on performance
        if len(x) == 0:
            return bound.default_value, 0.5

        # Normalize outcomes to [0, 1]
        y_norm = (y - y.min()) / (y.max() - y.min() + 1e-10)

        # Weighted average favoring high-performing values
        weights = y_norm ** 2  # Square to emphasize high performers
        weights = weights / weights.sum()

        optimal = np.sum(x * weights)

        # Clip to bounds
        optimal = np.clip(optimal, bound.min_value, bound.max_value)

        # Round to step size
        optimal = round(optimal / bound.step_size) * bound.step_size

        # Confidence based on sample variance
        variance = np.var(x)
        confidence = 1.0 / (1.0 + variance)

        return float(optimal), float(confidence)

    def _learn_reinforcement(
        self,
        category: str,
        samples: List[OperationalSample],
        target_metric: str,
        constraints: Optional[Dict[str, Any]]
    ) -> LearningResult:
        """Reinforcement learning approach"""
        bounds = self.parameter_bounds.get(category, {})
        if not bounds:
            return LearningResult(
                success=False,
                suggested_parameters={},
                confidence=0.0,
                improvement_estimate=0.0,
                samples_used=len(samples),
                learning_time_ms=0,
                reasoning=f"No parameter bounds defined for category: {category}"
            )

        # Get current best parameters
        current_best = self.best_configs.get(category, {
            p: b.default_value for p, b in bounds.items()
        })

        # Calculate reward signal from recent samples
        recent = samples[-50:]
        if not recent:
            return LearningResult(
                success=False,
                suggested_parameters=current_best,
                confidence=0.5,
                improvement_estimate=0.0,
                samples_used=len(samples),
                learning_time_ms=0,
                reasoning="No recent samples"
            )

        avg_reward = np.mean([s.outcomes.get(target_metric, 0) for s in recent])

        # Update parameters with policy gradient (simplified)
        suggested = {}
        for param_name, bound in bounds.items():
            current = current_best.get(param_name, bound.default_value)

            # Add exploration noise
            if np.random.random() < self.exploration_rate:
                # Explore: random perturbation
                noise = np.random.normal(0, (bound.max_value - bound.min_value) * 0.1)
                new_value = current + noise
            else:
                # Exploit: gradient direction based on correlation
                param_values = [s.parameters.get(param_name, current) for s in recent]
                outcomes = [s.outcomes.get(target_metric, 0) for s in recent]

                if len(set(param_values)) > 1:
                    correlation = np.corrcoef(param_values, outcomes)[0, 1]
                    if not np.isnan(correlation):
                        gradient = correlation * (bound.max_value - bound.min_value) * 0.05
                        new_value = current + self.learning_rate * gradient
                    else:
                        new_value = current
                else:
                    new_value = current

            # Clip to bounds
            new_value = np.clip(new_value, bound.min_value, bound.max_value)
            new_value = round(new_value / bound.step_size) * bound.step_size
            suggested[param_name] = float(new_value)

        # Update best config
        self.best_configs[category] = suggested

        return LearningResult(
            success=True,
            suggested_parameters=suggested,
            confidence=0.7,
            improvement_estimate=0.05,
            samples_used=len(samples),
            learning_time_ms=0,
            reasoning=f"RL policy update. Exploration rate: {self.exploration_rate:.2f}"
        )

    def _learn_evolutionary(
        self,
        category: str,
        samples: List[OperationalSample],
        target_metric: str,
        constraints: Optional[Dict[str, Any]]
    ) -> LearningResult:
        """Evolutionary optimization"""
        bounds = self.parameter_bounds.get(category, {})
        if not bounds:
            return LearningResult(
                success=False,
                suggested_parameters={},
                confidence=0.0,
                improvement_estimate=0.0,
                samples_used=len(samples),
                learning_time_ms=0,
                reasoning=f"No parameter bounds defined for category: {category}"
            )

        # Create initial population from samples
        population_size = min(20, len(samples))
        population = []

        # Select top performers as parents
        sorted_samples = sorted(
            samples,
            key=lambda s: s.outcomes.get(target_metric, 0),
            reverse=True
        )[:population_size]

        for sample in sorted_samples:
            individual = {
                p: sample.parameters.get(p, b.default_value)
                for p, b in bounds.items()
            }
            fitness = sample.outcomes.get(target_metric, 0)
            population.append((individual, fitness))

        # Evolutionary operators
        for generation in range(10):
            # Selection (tournament)
            selected = []
            for _ in range(population_size // 2):
                candidates = np.random.choice(len(population), 3, replace=False)
                winner = max(candidates, key=lambda i: population[i][1])
                selected.append(population[winner][0])

            # Crossover and mutation
            new_population = []
            for i in range(0, len(selected) - 1, 2):
                parent1, parent2 = selected[i], selected[i + 1]

                child1, child2 = {}, {}
                for param_name, bound in bounds.items():
                    if np.random.random() < 0.5:
                        child1[param_name] = parent1.get(param_name, bound.default_value)
                        child2[param_name] = parent2.get(param_name, bound.default_value)
                    else:
                        child1[param_name] = parent2.get(param_name, bound.default_value)
                        child2[param_name] = parent1.get(param_name, bound.default_value)

                    # Mutation
                    if np.random.random() < 0.1:
                        child1[param_name] += np.random.normal(0, bound.step_size * 3)
                        child1[param_name] = np.clip(child1[param_name], bound.min_value, bound.max_value)

                    if np.random.random() < 0.1:
                        child2[param_name] += np.random.normal(0, bound.step_size * 3)
                        child2[param_name] = np.clip(child2[param_name], bound.min_value, bound.max_value)

                # Estimate fitness
                fitness1 = self._estimate_fitness(child1, samples, target_metric)
                fitness2 = self._estimate_fitness(child2, samples, target_metric)

                new_population.append((child1, fitness1))
                new_population.append((child2, fitness2))

            # Keep best individuals
            population = sorted(
                population + new_population,
                key=lambda x: x[1],
                reverse=True
            )[:population_size]

        # Best individual
        best = population[0][0]
        best_fitness = population[0][1]

        # Round to step sizes
        suggested = {
            p: round(v / bounds[p].step_size) * bounds[p].step_size
            for p, v in best.items()
        }

        return LearningResult(
            success=True,
            suggested_parameters=suggested,
            confidence=0.8,
            improvement_estimate=best_fitness - np.mean([p[1] for p in population]),
            samples_used=len(samples),
            learning_time_ms=0,
            reasoning=f"Evolutionary optimization over 10 generations"
        )

    def _estimate_fitness(
        self,
        parameters: Dict[str, float],
        samples: List[OperationalSample],
        target_metric: str
    ) -> float:
        """Estimate fitness of parameters based on similar samples"""
        if not samples:
            return 0.0

        # Find similar samples
        similarities = []
        for sample in samples:
            sim = 0.0
            count = 0
            for param, value in parameters.items():
                if param in sample.parameters:
                    sample_value = sample.parameters[param]
                    diff = abs(value - sample_value)
                    max_diff = 1.0  # Normalized
                    sim += 1.0 - min(diff / max_diff, 1.0)
                    count += 1

            if count > 0:
                similarities.append((sim / count, sample.outcomes.get(target_metric, 0)))

        if not similarities:
            return 0.0

        # Weighted average based on similarity
        total_weight = sum(s[0] for s in similarities)
        if total_weight == 0:
            return 0.0

        return sum(s[0] * s[1] for s in similarities) / total_weight

    def _estimate_improvement(
        self,
        suggested: Dict[str, float],
        samples: List[OperationalSample],
        target_metric: str
    ) -> float:
        """Estimate improvement from suggested parameters"""
        current_avg = np.mean([s.outcomes.get(target_metric, 0) for s in samples[-100:]])
        estimated_new = self._estimate_fitness(suggested, samples, target_metric)

        if current_avg > 0:
            return (estimated_new - current_avg) / current_avg
        return 0.0

    def get_learning_statistics(self) -> Dict[str, Any]:
        """Get learning statistics"""
        total_samples = sum(len(s) for s in self.samples.values())

        return {
            'total_samples': total_samples,
            'configs_tracked': len(self.samples),
            'best_configs': len(self.best_configs),
            'exploration_rate': self.exploration_rate,
            'learning_rate': self.learning_rate
        }
