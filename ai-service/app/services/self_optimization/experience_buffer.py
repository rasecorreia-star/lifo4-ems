"""
Experience Buffer for Reinforcement Learning
Implements prioritized experience replay with various sampling strategies.
"""

import numpy as np
from typing import Dict, Any, Optional, List, Tuple, NamedTuple
from dataclasses import dataclass, field
from collections import deque
import random
import pickle
import gzip
from datetime import datetime
import logging
import threading
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class Experience(NamedTuple):
    """Single experience tuple (SARS')"""
    state: np.ndarray
    action: np.ndarray
    reward: float
    next_state: np.ndarray
    done: bool
    info: Optional[Dict[str, Any]] = None


@dataclass
class ExperienceBatch:
    """Batch of experiences for training"""
    states: np.ndarray
    actions: np.ndarray
    rewards: np.ndarray
    next_states: np.ndarray
    dones: np.ndarray
    indices: Optional[np.ndarray] = None
    weights: Optional[np.ndarray] = None

    def __len__(self) -> int:
        return len(self.states)


class SumTree:
    """
    Sum Tree data structure for efficient prioritized sampling.
    Used in Prioritized Experience Replay.
    """

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.tree = np.zeros(2 * capacity - 1)
        self.data = np.zeros(capacity, dtype=object)
        self.write_index = 0
        self.n_entries = 0

    def _propagate(self, idx: int, change: float):
        """Propagate priority change up the tree"""
        parent = (idx - 1) // 2
        self.tree[parent] += change
        if parent != 0:
            self._propagate(parent, change)

    def _retrieve(self, idx: int, s: float) -> int:
        """Retrieve leaf index for given cumulative sum"""
        left = 2 * idx + 1
        right = left + 1

        if left >= len(self.tree):
            return idx

        if s <= self.tree[left]:
            return self._retrieve(left, s)
        else:
            return self._retrieve(right, s - self.tree[left])

    def total(self) -> float:
        """Get total priority sum"""
        return self.tree[0]

    def add(self, priority: float, data: Any):
        """Add data with given priority"""
        idx = self.write_index + self.capacity - 1

        self.data[self.write_index] = data
        self.update(idx, priority)

        self.write_index = (self.write_index + 1) % self.capacity
        self.n_entries = min(self.n_entries + 1, self.capacity)

    def update(self, idx: int, priority: float):
        """Update priority at given index"""
        change = priority - self.tree[idx]
        self.tree[idx] = priority
        self._propagate(idx, change)

    def get(self, s: float) -> Tuple[int, float, Any]:
        """Get (index, priority, data) for cumulative sum s"""
        idx = self._retrieve(0, s)
        data_idx = idx - self.capacity + 1
        return idx, self.tree[idx], self.data[data_idx]


class BaseBuffer(ABC):
    """Abstract base class for experience buffers"""

    @abstractmethod
    def add(self, experience: Experience):
        """Add experience to buffer"""
        pass

    @abstractmethod
    def sample(self, batch_size: int) -> ExperienceBatch:
        """Sample batch of experiences"""
        pass

    @abstractmethod
    def __len__(self) -> int:
        """Get buffer size"""
        pass


class ExperienceBuffer(BaseBuffer):
    """
    Experience Replay Buffer for RL training.
    Supports uniform and prioritized sampling.
    """

    def __init__(
        self,
        capacity: int = 100000,
        prioritized: bool = True,
        alpha: float = 0.6,
        beta: float = 0.4,
        beta_increment: float = 0.001,
        epsilon: float = 1e-6
    ):
        """
        Initialize experience buffer.

        Args:
            capacity: Maximum buffer size
            prioritized: Use prioritized experience replay
            alpha: Priority exponent (0 = uniform, 1 = full prioritization)
            beta: Importance sampling exponent
            beta_increment: Beta annealing per sample
            epsilon: Small constant for numerical stability
        """
        self.capacity = capacity
        self.prioritized = prioritized
        self.alpha = alpha
        self.beta = beta
        self.beta_increment = beta_increment
        self.epsilon = epsilon

        if prioritized:
            self.tree = SumTree(capacity)
            self.max_priority = 1.0
        else:
            self.buffer = deque(maxlen=capacity)

        self.lock = threading.Lock()
        self._stats = {
            'total_added': 0,
            'total_sampled': 0,
            'priority_updates': 0
        }

    def add(self, experience: Experience):
        """Add experience to buffer"""
        with self.lock:
            if self.prioritized:
                # New experiences get max priority
                self.tree.add(self.max_priority ** self.alpha, experience)
            else:
                self.buffer.append(experience)

            self._stats['total_added'] += 1

    def add_batch(self, experiences: List[Experience]):
        """Add multiple experiences"""
        for exp in experiences:
            self.add(exp)

    def sample(self, batch_size: int) -> ExperienceBatch:
        """Sample batch of experiences"""
        with self.lock:
            if self.prioritized:
                return self._prioritized_sample(batch_size)
            else:
                return self._uniform_sample(batch_size)

    def _uniform_sample(self, batch_size: int) -> ExperienceBatch:
        """Uniform random sampling"""
        batch_size = min(batch_size, len(self.buffer))
        experiences = random.sample(list(self.buffer), batch_size)

        self._stats['total_sampled'] += batch_size

        return self._experiences_to_batch(experiences)

    def _prioritized_sample(self, batch_size: int) -> ExperienceBatch:
        """Prioritized sampling with importance weights"""
        batch_size = min(batch_size, self.tree.n_entries)

        experiences = []
        indices = []
        priorities = []

        # Divide total priority into segments
        segment = self.tree.total() / batch_size

        # Anneal beta
        self.beta = min(1.0, self.beta + self.beta_increment)

        for i in range(batch_size):
            # Sample from segment
            a = segment * i
            b = segment * (i + 1)
            s = random.uniform(a, b)

            idx, priority, data = self.tree.get(s)

            if data is not None and isinstance(data, Experience):
                experiences.append(data)
                indices.append(idx)
                priorities.append(priority)

        if not experiences:
            # Fallback to random sampling
            return self._fallback_sample(batch_size)

        # Calculate importance sampling weights
        priorities = np.array(priorities)
        probabilities = priorities / self.tree.total()
        weights = (self.tree.n_entries * probabilities) ** (-self.beta)
        weights = weights / weights.max()  # Normalize

        self._stats['total_sampled'] += len(experiences)

        batch = self._experiences_to_batch(experiences)
        batch.indices = np.array(indices)
        batch.weights = weights

        return batch

    def _fallback_sample(self, batch_size: int) -> ExperienceBatch:
        """Fallback sampling when tree is corrupted"""
        experiences = []
        for i in range(min(batch_size, self.tree.n_entries)):
            data = self.tree.data[i]
            if isinstance(data, Experience):
                experiences.append(data)

        if not experiences:
            # Create dummy experience
            experiences = [Experience(
                state=np.zeros(10),
                action=np.zeros(1),
                reward=0.0,
                next_state=np.zeros(10),
                done=False
            )]

        return self._experiences_to_batch(experiences)

    def _experiences_to_batch(self, experiences: List[Experience]) -> ExperienceBatch:
        """Convert list of experiences to batch"""
        states = np.array([e.state for e in experiences])
        actions = np.array([e.action for e in experiences])
        rewards = np.array([e.reward for e in experiences])
        next_states = np.array([e.next_state for e in experiences])
        dones = np.array([e.done for e in experiences])

        return ExperienceBatch(
            states=states,
            actions=actions,
            rewards=rewards,
            next_states=next_states,
            dones=dones
        )

    def update_priorities(self, indices: np.ndarray, td_errors: np.ndarray):
        """Update priorities based on TD errors"""
        if not self.prioritized:
            return

        with self.lock:
            for idx, error in zip(indices, td_errors):
                priority = (abs(error) + self.epsilon) ** self.alpha
                self.tree.update(idx, priority)
                self.max_priority = max(self.max_priority, priority)

            self._stats['priority_updates'] += len(indices)

    def __len__(self) -> int:
        """Get current buffer size"""
        if self.prioritized:
            return self.tree.n_entries
        return len(self.buffer)

    def is_ready(self, batch_size: int) -> bool:
        """Check if buffer has enough samples"""
        return len(self) >= batch_size

    def clear(self):
        """Clear the buffer"""
        with self.lock:
            if self.prioritized:
                self.tree = SumTree(self.capacity)
                self.max_priority = 1.0
            else:
                self.buffer.clear()

            self._stats = {
                'total_added': 0,
                'total_sampled': 0,
                'priority_updates': 0
            }

    def get_statistics(self) -> Dict[str, Any]:
        """Get buffer statistics"""
        return {
            'capacity': self.capacity,
            'size': len(self),
            'fill_ratio': len(self) / self.capacity,
            'prioritized': self.prioritized,
            'beta': self.beta if self.prioritized else None,
            'max_priority': self.max_priority if self.prioritized else None,
            **self._stats
        }

    def save(self, filepath: str):
        """Save buffer to file"""
        with gzip.open(filepath, 'wb') as f:
            data = {
                'capacity': self.capacity,
                'prioritized': self.prioritized,
                'alpha': self.alpha,
                'beta': self.beta,
                'experiences': list(self.buffer) if not self.prioritized else [
                    self.tree.data[i] for i in range(self.tree.n_entries)
                    if isinstance(self.tree.data[i], Experience)
                ]
            }
            pickle.dump(data, f)
        logger.info(f"Saved buffer to {filepath}")

    def load(self, filepath: str):
        """Load buffer from file"""
        with gzip.open(filepath, 'rb') as f:
            data = pickle.load(f)

        self.capacity = data['capacity']
        self.prioritized = data['prioritized']
        self.alpha = data['alpha']
        self.beta = data['beta']

        if self.prioritized:
            self.tree = SumTree(self.capacity)
            for exp in data['experiences']:
                self.add(exp)
        else:
            self.buffer = deque(data['experiences'], maxlen=self.capacity)

        logger.info(f"Loaded buffer from {filepath} ({len(self)} experiences)")


class EpisodeBuffer:
    """
    Buffer that stores complete episodes.
    Useful for trajectory-based methods.
    """

    def __init__(self, capacity: int = 1000):
        self.capacity = capacity
        self.episodes: deque = deque(maxlen=capacity)
        self.current_episode: List[Experience] = []

    def add(self, experience: Experience):
        """Add experience to current episode"""
        self.current_episode.append(experience)

        if experience.done:
            self.end_episode()

    def end_episode(self):
        """End current episode and store it"""
        if self.current_episode:
            self.episodes.append(list(self.current_episode))
            self.current_episode = []

    def sample_episodes(self, n_episodes: int) -> List[List[Experience]]:
        """Sample complete episodes"""
        n_episodes = min(n_episodes, len(self.episodes))
        return random.sample(list(self.episodes), n_episodes)

    def sample_transitions(self, batch_size: int) -> ExperienceBatch:
        """Sample individual transitions from episodes"""
        all_experiences = [exp for episode in self.episodes for exp in episode]
        batch_size = min(batch_size, len(all_experiences))
        experiences = random.sample(all_experiences, batch_size)

        return ExperienceBatch(
            states=np.array([e.state for e in experiences]),
            actions=np.array([e.action for e in experiences]),
            rewards=np.array([e.reward for e in experiences]),
            next_states=np.array([e.next_state for e in experiences]),
            dones=np.array([e.done for e in experiences])
        )

    def get_recent_episode(self) -> Optional[List[Experience]]:
        """Get most recent complete episode"""
        if self.episodes:
            return list(self.episodes[-1])
        return None

    def __len__(self) -> int:
        return len(self.episodes)


class HindsightBuffer(ExperienceBuffer):
    """
    Hindsight Experience Replay (HER) buffer.
    Augments experiences with alternative goals.
    """

    def __init__(
        self,
        capacity: int = 100000,
        n_sampled_goals: int = 4,
        goal_selection_strategy: str = 'future'
    ):
        super().__init__(capacity, prioritized=False)
        self.n_sampled_goals = n_sampled_goals
        self.goal_selection_strategy = goal_selection_strategy
        self.episode_buffer = EpisodeBuffer(capacity=1000)

    def add_episode(self, episode: List[Experience]):
        """Add episode with HER augmentation"""
        # Add original experiences
        for exp in episode:
            self.add(exp)
            self.episode_buffer.add(exp)

        # Generate hindsight experiences
        if self.goal_selection_strategy == 'future':
            self._add_future_goals(episode)
        elif self.goal_selection_strategy == 'final':
            self._add_final_goal(episode)

    def _add_future_goals(self, episode: List[Experience]):
        """Add experiences with future achieved goals"""
        for t, exp in enumerate(episode[:-1]):
            # Sample future states as goals
            future_indices = range(t + 1, len(episode))
            n_samples = min(self.n_sampled_goals, len(list(future_indices)))

            for idx in random.sample(list(future_indices), n_samples):
                future_state = episode[idx].state
                # Create hindsight experience (assuming goal is in state)
                hindsight_exp = Experience(
                    state=exp.state,
                    action=exp.action,
                    reward=1.0 if np.allclose(exp.next_state, future_state) else 0.0,
                    next_state=exp.next_state,
                    done=idx == len(episode) - 1,
                    info={'hindsight_goal': future_state.tolist()}
                )
                self.add(hindsight_exp)

    def _add_final_goal(self, episode: List[Experience]):
        """Add experiences with final achieved goal"""
        if not episode:
            return

        final_state = episode[-1].state

        for exp in episode[:-1]:
            hindsight_exp = Experience(
                state=exp.state,
                action=exp.action,
                reward=1.0 if np.allclose(exp.next_state, final_state) else 0.0,
                next_state=exp.next_state,
                done=False,
                info={'hindsight_goal': final_state.tolist()}
            )
            self.add(hindsight_exp)


# Utility functions
def create_buffer(
    capacity: int = 100000,
    buffer_type: str = 'prioritized'
) -> BaseBuffer:
    """Create experience buffer of specified type"""
    if buffer_type == 'prioritized':
        return ExperienceBuffer(capacity, prioritized=True)
    elif buffer_type == 'uniform':
        return ExperienceBuffer(capacity, prioritized=False)
    elif buffer_type == 'episode':
        return EpisodeBuffer(capacity)
    elif buffer_type == 'hindsight':
        return HindsightBuffer(capacity)
    else:
        return ExperienceBuffer(capacity)


def compute_n_step_returns(
    experiences: List[Experience],
    gamma: float = 0.99,
    n_steps: int = 3
) -> List[Experience]:
    """Compute n-step returns for experiences"""
    augmented = []

    for t in range(len(experiences)):
        # Compute n-step return
        n_step_return = 0.0
        for k in range(min(n_steps, len(experiences) - t)):
            n_step_return += (gamma ** k) * experiences[t + k].reward

        # Get state n steps ahead (or terminal state)
        n_ahead = min(n_steps, len(experiences) - t - 1)
        next_state = experiences[t + n_ahead].next_state
        done = experiences[t + n_ahead].done

        augmented.append(Experience(
            state=experiences[t].state,
            action=experiences[t].action,
            reward=n_step_return,
            next_state=next_state,
            done=done,
            info={'n_steps': n_ahead + 1}
        ))

    return augmented
