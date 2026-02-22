"""
In-memory circular buffer for telemetry data.
Used for quick access to recent readings without hitting SQLite.
"""
from __future__ import annotations

from collections import deque
from typing import Optional

from src.safety.safety_manager import TelemetrySnapshot


class TelemetryBuffer:
    """
    Circular buffer holding the last N telemetry snapshots in memory.
    Used for trend analysis and ML feature generation.
    Thread-safe for single asyncio event loop.
    """

    def __init__(self, maxlen: int = 720):  # Default: 720 × 5s = 1 hour
        self._buffer: deque[TelemetrySnapshot] = deque(maxlen=maxlen)

    def push(self, snapshot: TelemetrySnapshot) -> None:
        self._buffer.append(snapshot)

    def latest(self) -> Optional[TelemetrySnapshot]:
        return self._buffer[-1] if self._buffer else None

    def recent(self, count: int) -> list[TelemetrySnapshot]:
        """Get the last `count` snapshots (most recent last)."""
        return list(self._buffer)[-count:]

    def soc_history(self, count: int = 12) -> list[float]:
        """Get SOC values for last `count` readings."""
        return [s.soc for s in self.recent(count)]

    def power_history(self, count: int = 12) -> list[float]:
        """Get power values for last `count` readings."""
        return [s.power_kw for s in self.recent(count)]

    def avg_temperature(self, count: int = 6) -> float:
        """Average temperature over last `count` readings."""
        recent = self.recent(count)
        if not recent:
            return 25.0
        return sum(s.temp_avg for s in recent) / len(recent)

    def __len__(self) -> int:
        return len(self._buffer)
