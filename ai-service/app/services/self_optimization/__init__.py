"""
Self-Optimization Module
Implements self-evolving AI for BESS optimization using:
- Genetic Algorithms (DEAP)
- Reinforcement Learning (Stable Baselines3)
- Experience Replay
- Multi-objective Optimization
"""

from .genetic_optimizer import GeneticOptimizer, OptimizationConfig
from .rl_agent import RLAgent, BESSEnvironment
from .reward_calculator import RewardCalculator, RewardWeights
from .experience_buffer import ExperienceBuffer, Experience

__all__ = [
    'GeneticOptimizer',
    'OptimizationConfig',
    'RLAgent',
    'BESSEnvironment',
    'RewardCalculator',
    'RewardWeights',
    'ExperienceBuffer',
    'Experience'
]
