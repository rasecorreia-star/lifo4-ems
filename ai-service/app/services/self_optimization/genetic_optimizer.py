"""
Genetic Optimizer for BESS Parameters
Uses DEAP (Distributed Evolutionary Algorithms in Python) for
multi-objective optimization of battery system parameters.
"""

import random
import numpy as np
from typing import List, Tuple, Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
import json
import logging
from enum import Enum

# DEAP imports
try:
    from deap import base, creator, tools, algorithms
    DEAP_AVAILABLE = True
except ImportError:
    DEAP_AVAILABLE = False
    logging.warning("DEAP not installed. Genetic optimization will use fallback.")

logger = logging.getLogger(__name__)


class OptimizationObjective(Enum):
    """Optimization objectives for BESS"""
    MINIMIZE_COST = "minimize_cost"
    MAXIMIZE_REVENUE = "maximize_revenue"
    MINIMIZE_DEGRADATION = "minimize_degradation"
    MAXIMIZE_EFFICIENCY = "maximize_efficiency"
    MINIMIZE_PEAK_DEMAND = "minimize_peak_demand"
    MAXIMIZE_SELF_CONSUMPTION = "maximize_self_consumption"
    MINIMIZE_CARBON = "minimize_carbon"


@dataclass
class OptimizationConfig:
    """Configuration for genetic optimization"""
    population_size: int = 100
    generations: int = 50
    crossover_prob: float = 0.7
    mutation_prob: float = 0.2
    tournament_size: int = 3
    elite_size: int = 5
    objectives: List[OptimizationObjective] = field(default_factory=lambda: [
        OptimizationObjective.MAXIMIZE_REVENUE,
        OptimizationObjective.MINIMIZE_DEGRADATION
    ])
    # Parameter bounds
    soc_min_bound: Tuple[float, float] = (10.0, 30.0)
    soc_max_bound: Tuple[float, float] = (70.0, 95.0)
    charge_rate_bound: Tuple[float, float] = (0.1, 1.0)  # C-rate
    discharge_rate_bound: Tuple[float, float] = (0.1, 1.0)
    price_threshold_buy_bound: Tuple[float, float] = (0.05, 0.20)  # $/kWh
    price_threshold_sell_bound: Tuple[float, float] = (0.10, 0.30)
    peak_shaving_threshold_bound: Tuple[float, float] = (0.5, 0.9)  # % of max demand


@dataclass
class Individual:
    """Represents an individual (solution) in the population"""
    soc_min: float
    soc_max: float
    charge_rate: float
    discharge_rate: float
    price_threshold_buy: float
    price_threshold_sell: float
    peak_shaving_threshold: float

    def to_dict(self) -> Dict[str, float]:
        return {
            'soc_min': self.soc_min,
            'soc_max': self.soc_max,
            'charge_rate': self.charge_rate,
            'discharge_rate': self.discharge_rate,
            'price_threshold_buy': self.price_threshold_buy,
            'price_threshold_sell': self.price_threshold_sell,
            'peak_shaving_threshold': self.peak_shaving_threshold
        }

    @classmethod
    def from_list(cls, values: List[float]) -> 'Individual':
        return cls(
            soc_min=values[0],
            soc_max=values[1],
            charge_rate=values[2],
            discharge_rate=values[3],
            price_threshold_buy=values[4],
            price_threshold_sell=values[5],
            peak_shaving_threshold=values[6]
        )

    def to_list(self) -> List[float]:
        return [
            self.soc_min, self.soc_max, self.charge_rate,
            self.discharge_rate, self.price_threshold_buy,
            self.price_threshold_sell, self.peak_shaving_threshold
        ]


@dataclass
class OptimizationResult:
    """Result of genetic optimization"""
    best_individual: Individual
    pareto_front: List[Individual]
    fitness_history: List[Dict[str, float]]
    generation_stats: List[Dict[str, Any]]
    total_generations: int
    convergence_generation: Optional[int]
    execution_time_seconds: float
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'best_individual': self.best_individual.to_dict(),
            'pareto_front': [ind.to_dict() for ind in self.pareto_front],
            'fitness_history': self.fitness_history,
            'total_generations': self.total_generations,
            'convergence_generation': self.convergence_generation,
            'execution_time_seconds': self.execution_time_seconds,
            'timestamp': self.timestamp.isoformat()
        }


class GeneticOptimizer:
    """
    Multi-objective genetic optimizer for BESS parameters.
    Uses NSGA-II algorithm for Pareto-optimal solutions.
    """

    def __init__(self, config: Optional[OptimizationConfig] = None):
        self.config = config or OptimizationConfig()
        self.toolbox = None
        self.history = []
        self._setup_deap()

    def _setup_deap(self):
        """Setup DEAP toolbox for multi-objective optimization"""
        if not DEAP_AVAILABLE:
            logger.warning("DEAP not available, using fallback optimization")
            return

        # Create fitness class (minimize degradation, maximize revenue)
        # Weights: negative = minimize, positive = maximize
        weights = []
        for obj in self.config.objectives:
            if obj in [OptimizationObjective.MINIMIZE_COST,
                      OptimizationObjective.MINIMIZE_DEGRADATION,
                      OptimizationObjective.MINIMIZE_PEAK_DEMAND,
                      OptimizationObjective.MINIMIZE_CARBON]:
                weights.append(-1.0)
            else:
                weights.append(1.0)

        # Create types (only once)
        if not hasattr(creator, "FitnessMulti"):
            creator.create("FitnessMulti", base.Fitness, weights=tuple(weights))
        if not hasattr(creator, "Individual"):
            creator.create("Individual", list, fitness=creator.FitnessMulti)

        self.toolbox = base.Toolbox()

        # Attribute generators
        self.toolbox.register("soc_min", random.uniform, *self.config.soc_min_bound)
        self.toolbox.register("soc_max", random.uniform, *self.config.soc_max_bound)
        self.toolbox.register("charge_rate", random.uniform, *self.config.charge_rate_bound)
        self.toolbox.register("discharge_rate", random.uniform, *self.config.discharge_rate_bound)
        self.toolbox.register("price_buy", random.uniform, *self.config.price_threshold_buy_bound)
        self.toolbox.register("price_sell", random.uniform, *self.config.price_threshold_sell_bound)
        self.toolbox.register("peak_threshold", random.uniform, *self.config.peak_shaving_threshold_bound)

        # Individual and population
        self.toolbox.register("individual", self._create_individual)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)

        # Genetic operators
        self.toolbox.register("mate", tools.cxSimulatedBinaryBounded,
                            low=[b[0] for b in self._get_bounds()],
                            up=[b[1] for b in self._get_bounds()],
                            eta=20.0)
        self.toolbox.register("mutate", tools.mutPolynomialBounded,
                            low=[b[0] for b in self._get_bounds()],
                            up=[b[1] for b in self._get_bounds()],
                            eta=20.0, indpb=1.0/7)
        self.toolbox.register("select", tools.selNSGA2)

    def _get_bounds(self) -> List[Tuple[float, float]]:
        """Get parameter bounds"""
        return [
            self.config.soc_min_bound,
            self.config.soc_max_bound,
            self.config.charge_rate_bound,
            self.config.discharge_rate_bound,
            self.config.price_threshold_buy_bound,
            self.config.price_threshold_sell_bound,
            self.config.peak_shaving_threshold_bound
        ]

    def _create_individual(self) -> list:
        """Create a random individual"""
        ind = creator.Individual([
            self.toolbox.soc_min(),
            self.toolbox.soc_max(),
            self.toolbox.charge_rate(),
            self.toolbox.discharge_rate(),
            self.toolbox.price_buy(),
            self.toolbox.price_sell(),
            self.toolbox.peak_threshold()
        ])
        # Ensure soc_min < soc_max
        if ind[0] > ind[1]:
            ind[0], ind[1] = ind[1], ind[0]
        # Ensure buy price < sell price
        if ind[4] > ind[5]:
            ind[4], ind[5] = ind[5], ind[4]
        return ind

    def optimize(
        self,
        evaluate_fn: Callable[[Individual], Tuple[float, ...]],
        callback: Optional[Callable[[int, List], None]] = None
    ) -> OptimizationResult:
        """
        Run genetic optimization.

        Args:
            evaluate_fn: Function that takes Individual and returns fitness tuple
            callback: Optional callback called after each generation

        Returns:
            OptimizationResult with best solutions
        """
        import time
        start_time = time.time()

        if not DEAP_AVAILABLE:
            return self._fallback_optimize(evaluate_fn)

        # Register evaluation function
        def evaluate_wrapper(individual):
            ind_obj = Individual.from_list(individual)
            return evaluate_fn(ind_obj)

        self.toolbox.register("evaluate", evaluate_wrapper)

        # Create initial population
        population = self.toolbox.population(n=self.config.population_size)

        # Evaluate initial population
        fitnesses = map(self.toolbox.evaluate, population)
        for ind, fit in zip(population, fitnesses):
            ind.fitness.values = fit

        # Statistics
        stats = tools.Statistics(lambda ind: ind.fitness.values)
        stats.register("min", np.min, axis=0)
        stats.register("max", np.max, axis=0)
        stats.register("avg", np.mean, axis=0)
        stats.register("std", np.std, axis=0)

        # Hall of fame for elite individuals
        hof = tools.ParetoFront()

        fitness_history = []
        generation_stats = []
        convergence_gen = None
        prev_best = None
        no_improvement_count = 0

        # Evolution loop
        for gen in range(self.config.generations):
            # Select next generation
            offspring = tools.selTournamentDCD(population, len(population))
            offspring = [self.toolbox.clone(ind) for ind in offspring]

            # Apply crossover
            for child1, child2 in zip(offspring[::2], offspring[1::2]):
                if random.random() < self.config.crossover_prob:
                    self.toolbox.mate(child1, child2)
                    del child1.fitness.values
                    del child2.fitness.values

            # Apply mutation
            for mutant in offspring:
                if random.random() < self.config.mutation_prob:
                    self.toolbox.mutate(mutant)
                    del mutant.fitness.values

            # Evaluate offspring with invalid fitness
            invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
            fitnesses = map(self.toolbox.evaluate, invalid_ind)
            for ind, fit in zip(invalid_ind, fitnesses):
                ind.fitness.values = fit

            # Select survivors (NSGA-II)
            population = self.toolbox.select(population + offspring, self.config.population_size)

            # Update hall of fame
            hof.update(population)

            # Record statistics
            record = stats.compile(population)
            generation_stats.append({
                'generation': gen,
                'min': record['min'].tolist(),
                'max': record['max'].tolist(),
                'avg': record['avg'].tolist(),
                'std': record['std'].tolist()
            })

            # Track best fitness
            best_fitness = min(ind.fitness.values[0] for ind in population)
            fitness_history.append({
                'generation': gen,
                'best_fitness': best_fitness,
                'pareto_size': len(hof)
            })

            # Check convergence
            if prev_best is not None:
                if abs(best_fitness - prev_best) < 1e-6:
                    no_improvement_count += 1
                    if no_improvement_count >= 10 and convergence_gen is None:
                        convergence_gen = gen
                else:
                    no_improvement_count = 0
            prev_best = best_fitness

            # Callback
            if callback:
                callback(gen, population)

            logger.debug(f"Generation {gen}: best={best_fitness:.4f}, pareto_size={len(hof)}")

        # Get results
        execution_time = time.time() - start_time

        # Best individual (first objective)
        best_ind = tools.selBest(population, 1)[0]

        # Pareto front
        pareto_front = [Individual.from_list(ind) for ind in hof]

        return OptimizationResult(
            best_individual=Individual.from_list(best_ind),
            pareto_front=pareto_front,
            fitness_history=fitness_history,
            generation_stats=generation_stats,
            total_generations=self.config.generations,
            convergence_generation=convergence_gen,
            execution_time_seconds=execution_time
        )

    def _fallback_optimize(
        self,
        evaluate_fn: Callable[[Individual], Tuple[float, ...]]
    ) -> OptimizationResult:
        """Fallback optimization when DEAP is not available"""
        import time
        start_time = time.time()

        # Simple random search
        best_individual = None
        best_fitness = float('inf')
        fitness_history = []

        for gen in range(self.config.generations):
            population = []
            for _ in range(self.config.population_size):
                ind = Individual(
                    soc_min=random.uniform(*self.config.soc_min_bound),
                    soc_max=random.uniform(*self.config.soc_max_bound),
                    charge_rate=random.uniform(*self.config.charge_rate_bound),
                    discharge_rate=random.uniform(*self.config.discharge_rate_bound),
                    price_threshold_buy=random.uniform(*self.config.price_threshold_buy_bound),
                    price_threshold_sell=random.uniform(*self.config.price_threshold_sell_bound),
                    peak_shaving_threshold=random.uniform(*self.config.peak_shaving_threshold_bound)
                )
                fitness = evaluate_fn(ind)
                if fitness[0] < best_fitness:
                    best_fitness = fitness[0]
                    best_individual = ind
                population.append(ind)

            fitness_history.append({
                'generation': gen,
                'best_fitness': best_fitness
            })

        return OptimizationResult(
            best_individual=best_individual,
            pareto_front=[best_individual],
            fitness_history=fitness_history,
            generation_stats=[],
            total_generations=self.config.generations,
            convergence_generation=None,
            execution_time_seconds=time.time() - start_time
        )

    def optimize_schedule(
        self,
        price_forecast: List[float],
        load_forecast: List[float],
        solar_forecast: Optional[List[float]] = None,
        battery_capacity_kwh: float = 100.0,
        max_power_kw: float = 50.0
    ) -> OptimizationResult:
        """
        Optimize battery schedule for given forecasts.

        Args:
            price_forecast: 24-hour price forecast ($/kWh)
            load_forecast: 24-hour load forecast (kW)
            solar_forecast: 24-hour solar generation forecast (kW)
            battery_capacity_kwh: Battery capacity
            max_power_kw: Maximum charge/discharge power

        Returns:
            OptimizationResult with optimized parameters
        """
        solar = solar_forecast or [0.0] * 24

        def evaluate(ind: Individual) -> Tuple[float, float]:
            """Evaluate individual for cost and degradation"""
            soc = 50.0  # Start at 50%
            total_cost = 0.0
            total_cycles = 0.0

            for hour in range(24):
                price = price_forecast[hour]
                load = load_forecast[hour]
                solar_gen = solar[hour]

                # Net load
                net_load = load - solar_gen

                # Decision based on parameters
                if price < ind.price_threshold_buy and soc < ind.soc_max:
                    # Charge
                    charge_power = min(max_power_kw * ind.charge_rate,
                                      (ind.soc_max - soc) * battery_capacity_kwh / 100)
                    soc += (charge_power / battery_capacity_kwh) * 100
                    total_cost += charge_power * price
                    total_cycles += charge_power / battery_capacity_kwh

                elif price > ind.price_threshold_sell and soc > ind.soc_min:
                    # Discharge
                    discharge_power = min(max_power_kw * ind.discharge_rate,
                                         (soc - ind.soc_min) * battery_capacity_kwh / 100,
                                         net_load)
                    soc -= (discharge_power / battery_capacity_kwh) * 100
                    total_cost -= discharge_power * price  # Revenue
                    total_cycles += discharge_power / battery_capacity_kwh

                elif net_load > max_power_kw * ind.peak_shaving_threshold and soc > ind.soc_min:
                    # Peak shaving
                    discharge_power = min(net_load - max_power_kw * ind.peak_shaving_threshold,
                                         max_power_kw * ind.discharge_rate,
                                         (soc - ind.soc_min) * battery_capacity_kwh / 100)
                    soc -= (discharge_power / battery_capacity_kwh) * 100
                    total_cost -= discharge_power * price * 0.5  # Reduced value for peak shaving
                    total_cycles += discharge_power / battery_capacity_kwh

            # Degradation cost (simplified model)
            degradation = total_cycles * 0.01  # 1% per full cycle

            return (total_cost, degradation)

        return self.optimize(evaluate)


# Utility functions
def create_default_optimizer() -> GeneticOptimizer:
    """Create optimizer with default configuration"""
    return GeneticOptimizer()


def quick_optimize(
    price_forecast: List[float],
    load_forecast: List[float],
    generations: int = 20
) -> Dict[str, Any]:
    """Quick optimization with minimal configuration"""
    config = OptimizationConfig(
        population_size=50,
        generations=generations
    )
    optimizer = GeneticOptimizer(config)
    result = optimizer.optimize_schedule(price_forecast, load_forecast)
    return result.to_dict()
