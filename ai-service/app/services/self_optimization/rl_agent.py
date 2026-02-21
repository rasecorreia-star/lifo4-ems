"""
Reinforcement Learning Agent for BESS Control
Uses Stable Baselines3 with custom Gymnasium environment.
"""

import numpy as np
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass, field
from datetime import datetime
import logging
import json
import os

# Gymnasium for RL environment
try:
    import gymnasium as gym
    from gymnasium import spaces
    GYM_AVAILABLE = True
except ImportError:
    GYM_AVAILABLE = False
    logging.warning("Gymnasium not installed. RL agent will use fallback.")

# Stable Baselines3 for RL algorithms
try:
    from stable_baselines3 import PPO, SAC, TD3, A2C
    from stable_baselines3.common.callbacks import BaseCallback, EvalCallback
    from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
    from stable_baselines3.common.monitor import Monitor
    SB3_AVAILABLE = True
except ImportError:
    SB3_AVAILABLE = False
    logging.warning("Stable Baselines3 not installed. RL agent will use fallback.")

logger = logging.getLogger(__name__)


@dataclass
class BESSState:
    """State representation of BESS"""
    soc: float  # State of charge (0-100)
    soh: float  # State of health (0-100)
    temperature: float  # Battery temperature (C)
    power: float  # Current power (kW, positive=discharge)
    hour: int  # Hour of day (0-23)
    price: float  # Current electricity price ($/kWh)
    load: float  # Current load demand (kW)
    solar: float  # Current solar generation (kW)
    grid_frequency: float  # Grid frequency (Hz)
    peak_demand: float  # Peak demand so far today (kW)


@dataclass
class BESSAction:
    """Action for BESS control"""
    power_setpoint: float  # Power setpoint (kW, positive=discharge)
    mode: str  # Operating mode: 'charge', 'discharge', 'idle', 'peak_shave'


@dataclass
class RLConfig:
    """Configuration for RL agent"""
    algorithm: str = "PPO"  # PPO, SAC, TD3, A2C
    learning_rate: float = 3e-4
    batch_size: int = 64
    n_steps: int = 2048
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_range: float = 0.2
    ent_coef: float = 0.01
    total_timesteps: int = 100000
    eval_freq: int = 10000
    n_eval_episodes: int = 5
    model_save_path: str = "./models/rl_bess"


class BESSEnvironment(gym.Env):
    """
    Custom Gymnasium environment for BESS control.
    Implements realistic battery dynamics and economic optimization.
    """

    metadata = {'render_modes': ['human', 'rgb_array']}

    def __init__(
        self,
        battery_capacity_kwh: float = 100.0,
        max_power_kw: float = 50.0,
        efficiency: float = 0.95,
        price_data: Optional[List[float]] = None,
        load_data: Optional[List[float]] = None,
        solar_data: Optional[List[float]] = None,
        episode_length: int = 24,
        render_mode: Optional[str] = None
    ):
        super().__init__()

        self.battery_capacity = battery_capacity_kwh
        self.max_power = max_power_kw
        self.efficiency = efficiency
        self.episode_length = episode_length
        self.render_mode = render_mode

        # Default data (can be overridden)
        self.price_data = price_data or self._default_price_data()
        self.load_data = load_data or self._default_load_data()
        self.solar_data = solar_data or self._default_solar_data()

        # Action space: continuous power setpoint [-1, 1] scaled to max_power
        # -1 = full charge, +1 = full discharge
        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(1,), dtype=np.float32
        )

        # Observation space
        self.observation_space = spaces.Box(
            low=np.array([0, 0, -40, -self.max_power, 0, 0, 0, 0, 49, 0], dtype=np.float32),
            high=np.array([100, 100, 60, self.max_power, 23, 1, 200, 200, 51, 200], dtype=np.float32),
            dtype=np.float32
        )

        # State variables
        self.state = None
        self.current_step = 0
        self.total_reward = 0
        self.episode_history = []

    def _default_price_data(self) -> List[float]:
        """Generate default price profile (TOU)"""
        # Off-peak: 0-6, 22-24; Mid-peak: 6-9, 21-22; Peak: 9-21
        prices = []
        for h in range(24):
            if h < 6 or h >= 22:
                prices.append(0.08)  # Off-peak
            elif h < 9 or h >= 21:
                prices.append(0.15)  # Mid-peak
            else:
                prices.append(0.25)  # Peak
        return prices

    def _default_load_data(self) -> List[float]:
        """Generate default load profile"""
        # Typical commercial load pattern
        loads = []
        for h in range(24):
            if h < 6:
                loads.append(20 + np.random.normal(0, 2))
            elif h < 9:
                loads.append(50 + np.random.normal(0, 5))
            elif h < 18:
                loads.append(80 + np.random.normal(0, 10))
            elif h < 21:
                loads.append(60 + np.random.normal(0, 5))
            else:
                loads.append(30 + np.random.normal(0, 3))
        return [max(0, l) for l in loads]

    def _default_solar_data(self) -> List[float]:
        """Generate default solar profile"""
        solar = []
        for h in range(24):
            if 6 <= h <= 18:
                # Bell curve centered at noon
                solar.append(40 * np.sin((h - 6) * np.pi / 12) + np.random.normal(0, 3))
            else:
                solar.append(0)
        return [max(0, s) for s in solar]

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict] = None
    ) -> Tuple[np.ndarray, Dict]:
        """Reset environment to initial state"""
        super().reset(seed=seed)

        # Randomize initial SOC
        initial_soc = np.random.uniform(30, 70)

        self.state = BESSState(
            soc=initial_soc,
            soh=100.0,
            temperature=25.0,
            power=0.0,
            hour=0,
            price=self.price_data[0],
            load=self.load_data[0],
            solar=self.solar_data[0],
            grid_frequency=60.0,
            peak_demand=0.0
        )

        self.current_step = 0
        self.total_reward = 0
        self.episode_history = []

        # Regenerate stochastic data
        self.load_data = self._default_load_data()
        self.solar_data = self._default_solar_data()

        return self._get_observation(), {}

    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        """Execute action and return next state"""
        # Scale action to power range
        power_setpoint = action[0] * self.max_power

        # Calculate actual power considering constraints
        actual_power = self._apply_power_constraints(power_setpoint)

        # Update SOC
        if actual_power > 0:  # Discharge
            energy_out = actual_power * 1.0  # 1 hour timestep
            self.state.soc -= (energy_out / self.battery_capacity) * 100 / self.efficiency
        else:  # Charge
            energy_in = abs(actual_power) * 1.0
            self.state.soc += (energy_in * self.efficiency / self.battery_capacity) * 100

        self.state.soc = np.clip(self.state.soc, 0, 100)
        self.state.power = actual_power

        # Update temperature (simplified model)
        power_ratio = abs(actual_power) / self.max_power
        self.state.temperature = 25 + 15 * power_ratio + np.random.normal(0, 1)

        # Calculate reward
        reward = self._calculate_reward(actual_power)
        self.total_reward += reward

        # Record history
        self.episode_history.append({
            'step': self.current_step,
            'soc': self.state.soc,
            'power': actual_power,
            'price': self.state.price,
            'load': self.state.load,
            'solar': self.state.solar,
            'reward': reward
        })

        # Advance time
        self.current_step += 1
        self.state.hour = self.current_step % 24

        # Update external conditions
        if self.current_step < len(self.price_data):
            self.state.price = self.price_data[self.current_step % 24]
            self.state.load = self.load_data[self.current_step % 24]
            self.state.solar = self.solar_data[self.current_step % 24]

        # Update peak demand
        net_load = self.state.load - self.state.solar + actual_power
        self.state.peak_demand = max(self.state.peak_demand, net_load)

        # Check termination
        terminated = self.current_step >= self.episode_length
        truncated = False

        info = {
            'total_reward': self.total_reward,
            'soc': self.state.soc,
            'peak_demand': self.state.peak_demand
        }

        return self._get_observation(), reward, terminated, truncated, info

    def _apply_power_constraints(self, power_setpoint: float) -> float:
        """Apply physical constraints to power setpoint"""
        if power_setpoint > 0:  # Discharge
            max_discharge = (self.state.soc / 100) * self.battery_capacity
            return min(power_setpoint, self.max_power, max_discharge)
        else:  # Charge
            max_charge = ((100 - self.state.soc) / 100) * self.battery_capacity
            return max(power_setpoint, -self.max_power, -max_charge)

    def _calculate_reward(self, power: float) -> float:
        """Calculate reward based on multiple objectives"""
        reward = 0.0

        # Economic reward: arbitrage
        if power > 0:  # Discharge = revenue
            reward += power * self.state.price * 0.1
        else:  # Charge = cost
            reward += power * self.state.price * 0.1  # Negative power, so this subtracts

        # Peak shaving reward
        net_load = self.state.load - self.state.solar
        if power > 0 and net_load > 50:  # Helping with peak
            reward += 0.05 * min(power, net_load - 50)

        # Self-consumption reward (use solar)
        if power < 0 and self.state.solar > 0:  # Charging during solar
            reward += 0.02 * min(abs(power), self.state.solar)

        # Degradation penalty
        degradation = abs(power) / self.battery_capacity * 0.001
        reward -= degradation

        # SOC bounds penalty
        if self.state.soc < 20 or self.state.soc > 90:
            reward -= 0.1

        # Temperature penalty
        if self.state.temperature > 40:
            reward -= 0.05 * (self.state.temperature - 40)

        return reward

    def _get_observation(self) -> np.ndarray:
        """Convert state to observation array"""
        return np.array([
            self.state.soc,
            self.state.soh,
            self.state.temperature,
            self.state.power,
            self.state.hour,
            self.state.price,
            self.state.load,
            self.state.solar,
            self.state.grid_frequency,
            self.state.peak_demand
        ], dtype=np.float32)

    def render(self):
        """Render environment state"""
        if self.render_mode == 'human':
            print(f"Step {self.current_step}: SOC={self.state.soc:.1f}%, "
                  f"Power={self.state.power:.1f}kW, Price=${self.state.price:.3f}")


class TrainingCallback(BaseCallback):
    """Custom callback for monitoring training"""

    def __init__(self, verbose: int = 0):
        super().__init__(verbose)
        self.episode_rewards = []
        self.episode_lengths = []

    def _on_step(self) -> bool:
        if self.locals.get('dones', [False])[0]:
            info = self.locals.get('infos', [{}])[0]
            if 'total_reward' in info:
                self.episode_rewards.append(info['total_reward'])
        return True


class RLAgent:
    """
    Reinforcement Learning agent for BESS control.
    Supports PPO, SAC, TD3, and A2C algorithms.
    """

    def __init__(self, config: Optional[RLConfig] = None):
        self.config = config or RLConfig()
        self.model = None
        self.env = None
        self.training_history = []

    def create_environment(
        self,
        battery_capacity_kwh: float = 100.0,
        max_power_kw: float = 50.0,
        **kwargs
    ) -> 'BESSEnvironment':
        """Create BESS environment"""
        if not GYM_AVAILABLE:
            raise RuntimeError("Gymnasium is required for RL training")

        self.env = BESSEnvironment(
            battery_capacity_kwh=battery_capacity_kwh,
            max_power_kw=max_power_kw,
            **kwargs
        )
        return self.env

    def train(
        self,
        env: Optional['BESSEnvironment'] = None,
        total_timesteps: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Train the RL agent.

        Args:
            env: Environment to train on (uses self.env if None)
            total_timesteps: Override config total_timesteps

        Returns:
            Training statistics
        """
        if not SB3_AVAILABLE:
            return self._fallback_train()

        env = env or self.env
        if env is None:
            env = self.create_environment()

        timesteps = total_timesteps or self.config.total_timesteps

        # Wrap environment
        vec_env = DummyVecEnv([lambda: env])

        # Create model based on algorithm choice
        algorithm_class = {
            'PPO': PPO,
            'SAC': SAC,
            'TD3': TD3,
            'A2C': A2C
        }.get(self.config.algorithm, PPO)

        # Model hyperparameters
        model_kwargs = {
            'policy': 'MlpPolicy',
            'env': vec_env,
            'learning_rate': self.config.learning_rate,
            'gamma': self.config.gamma,
            'verbose': 1
        }

        if self.config.algorithm == 'PPO':
            model_kwargs.update({
                'n_steps': self.config.n_steps,
                'batch_size': self.config.batch_size,
                'gae_lambda': self.config.gae_lambda,
                'clip_range': self.config.clip_range,
                'ent_coef': self.config.ent_coef
            })
        elif self.config.algorithm in ['SAC', 'TD3']:
            model_kwargs.update({
                'batch_size': self.config.batch_size,
                'buffer_size': 100000
            })

        self.model = algorithm_class(**model_kwargs)

        # Training callback
        callback = TrainingCallback()

        # Train
        logger.info(f"Starting {self.config.algorithm} training for {timesteps} timesteps")
        self.model.learn(
            total_timesteps=timesteps,
            callback=callback,
            progress_bar=True
        )

        # Save model
        os.makedirs(os.path.dirname(self.config.model_save_path), exist_ok=True)
        self.model.save(self.config.model_save_path)

        return {
            'algorithm': self.config.algorithm,
            'total_timesteps': timesteps,
            'episode_rewards': callback.episode_rewards,
            'final_reward': callback.episode_rewards[-1] if callback.episode_rewards else 0,
            'model_path': self.config.model_save_path
        }

    def _fallback_train(self) -> Dict[str, Any]:
        """Fallback training when SB3 is not available"""
        logger.warning("Using fallback training (random policy)")
        return {
            'algorithm': 'random',
            'total_timesteps': 0,
            'episode_rewards': [],
            'message': 'Stable Baselines3 not installed'
        }

    def predict(self, observation: np.ndarray) -> Tuple[float, Dict]:
        """
        Predict action for given observation.

        Args:
            observation: Current state observation

        Returns:
            Tuple of (action, info)
        """
        if self.model is None:
            # Random action if no model
            return np.random.uniform(-1, 1), {'source': 'random'}

        action, _ = self.model.predict(observation, deterministic=True)
        return float(action[0]), {'source': self.config.algorithm}

    def load(self, path: Optional[str] = None) -> bool:
        """Load trained model"""
        if not SB3_AVAILABLE:
            return False

        path = path or self.config.model_save_path

        algorithm_class = {
            'PPO': PPO,
            'SAC': SAC,
            'TD3': TD3,
            'A2C': A2C
        }.get(self.config.algorithm, PPO)

        try:
            self.model = algorithm_class.load(path)
            logger.info(f"Loaded model from {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False

    def evaluate(
        self,
        env: Optional['BESSEnvironment'] = None,
        n_episodes: int = 10
    ) -> Dict[str, float]:
        """
        Evaluate agent performance.

        Args:
            env: Environment for evaluation
            n_episodes: Number of evaluation episodes

        Returns:
            Evaluation metrics
        """
        env = env or self.env
        if env is None:
            env = self.create_environment()

        total_rewards = []
        total_peak_demands = []

        for _ in range(n_episodes):
            obs, _ = env.reset()
            episode_reward = 0
            done = False

            while not done:
                action, _ = self.predict(obs)
                obs, reward, terminated, truncated, info = env.step(np.array([action]))
                episode_reward += reward
                done = terminated or truncated

            total_rewards.append(episode_reward)
            total_peak_demands.append(info.get('peak_demand', 0))

        return {
            'mean_reward': np.mean(total_rewards),
            'std_reward': np.std(total_rewards),
            'min_reward': np.min(total_rewards),
            'max_reward': np.max(total_rewards),
            'mean_peak_demand': np.mean(total_peak_demands)
        }


# Utility functions
def create_trained_agent(
    battery_capacity_kwh: float = 100.0,
    max_power_kw: float = 50.0,
    timesteps: int = 50000
) -> RLAgent:
    """Create and train an RL agent"""
    agent = RLAgent()
    agent.create_environment(battery_capacity_kwh, max_power_kw)
    agent.train(total_timesteps=timesteps)
    return agent
