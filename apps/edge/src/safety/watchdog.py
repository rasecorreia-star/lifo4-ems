"""
Software watchdog for the edge controller.
Sends heartbeats; if the control loop freezes, the watchdog triggers restart.
"""
from __future__ import annotations

import asyncio
import time
from typing import Callable, Optional

from src.utils.logger import get_logger

logger = get_logger(__name__)


class SoftwareWatchdog:
    """
    Monitors control loop liveness via heartbeats.
    If no heartbeat is received within timeout, calls the restart callback.
    """

    def __init__(self, timeout_seconds: float = 30.0, on_timeout: Optional[Callable] = None):
        self._timeout = timeout_seconds
        self._last_heartbeat = time.monotonic()
        self._on_timeout = on_timeout
        self._running = False

    async def start(self) -> None:
        """Start the watchdog monitor loop."""
        self._running = True
        self._last_heartbeat = time.monotonic()
        logger.info("watchdog_started", timeout_seconds=self._timeout)
        asyncio.create_task(self._monitor())

    async def stop(self) -> None:
        self._running = False
        logger.info("watchdog_stopped")

    def heartbeat(self) -> None:
        """Call this regularly from the control loop to signal liveness."""
        self._last_heartbeat = time.monotonic()

    async def _monitor(self) -> None:
        while self._running:
            await asyncio.sleep(self._timeout / 2)
            elapsed = time.monotonic() - self._last_heartbeat
            if elapsed > self._timeout:
                logger.critical(
                    "watchdog_timeout",
                    elapsed_seconds=elapsed,
                    timeout_seconds=self._timeout,
                )
                if self._on_timeout:
                    await self._on_timeout()
                else:
                    # Default: raise exception to trigger process restart by supervisor
                    raise RuntimeError(
                        f"Watchdog timeout: no heartbeat for {elapsed:.0f}s"
                    )
