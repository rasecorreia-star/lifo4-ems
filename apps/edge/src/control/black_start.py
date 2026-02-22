"""
Black Start controller — island mode and grid reconnection.
This is the #1 justification for the edge controller:
if the grid fails, the cloud may also be offline, so this MUST run locally.

State machine: GRID_CONNECTED → GRID_FAILURE_DETECTED → TRANSFERRING
               → ISLAND_MODE → RECONNECTING → SYNCHRONIZING → GRID_CONNECTED

All transitions are local. Zero cloud dependency.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional

from src.safety.limits import (
    BLACKSTART_CONFIRM_READINGS,
    BLACKSTART_FREQ_MIN_HZ,
    BLACKSTART_VOLTAGE_MIN_V,
    BLACKSTART_VOLTAGE_RESTORE_V,  # F5: separate restore threshold
    GRID_FREQ_MAX_HZ,
    GRID_FREQ_MIN_HZ,
)
from src.utils.logger import get_logger
from src.utils.metrics import DECISIONS_TOTAL

logger = get_logger(__name__)


class GridState(Enum):
    GRID_CONNECTED = "GRID_CONNECTED"
    GRID_FAILURE_DETECTED = "GRID_FAILURE_DETECTED"
    TRANSFERRING = "TRANSFERRING"
    ISLAND_MODE = "ISLAND_MODE"
    RECONNECTING = "RECONNECTING"
    SYNCHRONIZING = "SYNCHRONIZING"


# Load priority levels — F4: exactly 6 levels as per spec (no "general"/7)
# Lower number = higher priority (never shed first)
LOAD_PRIORITIES = {
    1: "life_safety",        # Fire, security, emergency lighting — NEVER shed
    2: "communications",     # SCADA, UPS, comms
    3: "illumination",       # Critical illumination + security
    4: "hvac_servers",       # IT + data center
    5: "hvac_comfort",       # HVAC, air conditioning (priority 5 per spec)
    6: "elevators",          # Non-emergency elevators (priority 6 per spec)
}


@dataclass
class BlackStartStatus:
    state: GridState
    soc: float
    island_duration_seconds: float
    active_load_priorities: list[int]
    grid_frequency: float
    grid_voltage: float


class BlackStartController:
    """
    6-state FSM for grid failure detection and black start.
    Runs completely offline. Uses Modbus coils to control contactors.
    """

    def __init__(
        self,
        site_id: str,
        write_coil_fn: Optional[Callable] = None,    # async fn(name, value)
        notify_fn: Optional[Callable] = None,        # async fn(event, data)
    ):
        self._site_id = site_id
        self._write_coil = write_coil_fn
        self._notify = notify_fn

        self._state = GridState.GRID_CONNECTED
        self._failure_readings = 0          # Consecutive failure readings
        self._island_start_time: Optional[float] = None
        self._active_loads: list[int] = list(LOAD_PRIORITIES.keys())
        self._sync_start_time: Optional[float] = None

    @property
    def state(self) -> GridState:
        return self._state

    @property
    def is_island_mode(self) -> bool:
        return self._state == GridState.ISLAND_MODE

    @property
    def island_duration_seconds(self) -> float:
        if self._island_start_time is None:
            return 0.0
        return time.monotonic() - self._island_start_time

    async def process(self, frequency: float, grid_voltage: float, soc: float) -> BlackStartStatus:
        """
        Process current grid readings. Call every 200ms-5s.
        Returns current status.
        """
        await self._transition(frequency, grid_voltage, soc)
        await self._apply_load_shedding(soc)

        return BlackStartStatus(
            state=self._state,
            soc=soc,
            island_duration_seconds=self.island_duration_seconds,
            active_load_priorities=self._active_loads.copy(),
            grid_frequency=frequency,
            grid_voltage=grid_voltage,
        )

    async def _transition(self, freq: float, voltage: float, soc: float) -> None:
        """Run state machine transitions."""
        prev_state = self._state

        if self._state == GridState.GRID_CONNECTED:
            # Detect grid failure: tight thresholds, 2 consecutive readings
            # F3: BLACKSTART_VOLTAGE_MIN_V is now 180V (was incorrectly 190V)
            if freq < BLACKSTART_FREQ_MIN_HZ or voltage < BLACKSTART_VOLTAGE_MIN_V:
                self._failure_readings += 1
                if self._failure_readings >= BLACKSTART_CONFIRM_READINGS:
                    self._state = GridState.GRID_FAILURE_DETECTED
                    logger.critical("blackstart_grid_failure_detected",
                                    freq=freq, voltage=voltage)
            else:
                self._failure_readings = 0

        elif self._state == GridState.GRID_FAILURE_DETECTED:
            # Wait one more cycle then start transferring
            self._state = GridState.TRANSFERRING
            logger.critical("blackstart_transferring_to_island")
            await self._start_island_transfer()

        elif self._state == GridState.TRANSFERRING:
            # Transfer takes ~2-5 seconds (contactor operation)
            self._state = GridState.ISLAND_MODE
            self._island_start_time = time.monotonic()
            self._failure_readings = 0
            self._active_loads = list(LOAD_PRIORITIES.keys())
            logger.critical("blackstart_island_mode_active", soc=soc)
            await self._notify_event("island_mode_started", {"soc": soc})

        elif self._state == GridState.ISLAND_MODE:
            # F5: use BLACKSTART_VOLTAGE_RESTORE_V (210V) for restoration,
            # not BLACKSTART_VOLTAGE_MIN_V (180V) — prevents chattering
            if (freq >= GRID_FREQ_MIN_HZ and freq <= GRID_FREQ_MAX_HZ
                    and voltage >= BLACKSTART_VOLTAGE_RESTORE_V):
                self._state = GridState.RECONNECTING
                logger.info("blackstart_grid_recovered_starting_reconnect",
                            freq=freq, voltage=voltage)

        elif self._state == GridState.RECONNECTING:
            # Open backup contactor first, prepare for synchronization
            self._state = GridState.SYNCHRONIZING
            self._sync_start_time = time.monotonic()
            logger.info("blackstart_synchronizing")

        elif self._state == GridState.SYNCHRONIZING:
            # Wait for stable grid for 30 seconds, then reconnect
            sync_duration = time.monotonic() - (self._sync_start_time or time.monotonic())
            if (freq >= 59.9 and freq <= 60.1
                    and voltage >= BLACKSTART_VOLTAGE_RESTORE_V and sync_duration >= 30.0):
                self._state = GridState.GRID_CONNECTED
                self._island_start_time = None
                self._active_loads = list(LOAD_PRIORITIES.keys())
                logger.info("blackstart_grid_reconnected")
                await self._start_grid_reconnect()
                await self._notify_event("grid_reconnected", {"soc": soc})

        if self._state != prev_state:
            DECISIONS_TOTAL.labels(
                site_id=self._site_id,
                action=f"BLACKSTART_{self._state.value}",
            ).inc()

    async def _apply_load_shedding(self, soc: float) -> None:
        """
        Shed loads based on SOC when in island mode.
        F4: corrected priority thresholds per spec:
          SOC > 40%:  all loads (1-6)
          SOC 30-40%: shed elevators (priority 6) → keep 1-5
          SOC 20-30%: shed HVAC (priority 5)       → keep 1-4
          SOC 10-20%: only lighting+security+comms  → keep 1-3
          SOC < 10%:  emergency only                → keep 1-2
        """
        if self._state != GridState.ISLAND_MODE:
            return

        # Determine which loads to keep based on SOC (spec-compliant thresholds)
        if soc > 40.0:
            target_loads = [1, 2, 3, 4, 5, 6]   # All 6 loads — no shedding
        elif soc > 30.0:
            target_loads = [1, 2, 3, 4, 5]       # Shed elevators (priority 6)
        elif soc > 20.0:
            target_loads = [1, 2, 3, 4]           # Shed HVAC comfort (priority 5)
        elif soc > 10.0:
            target_loads = [1, 2, 3]              # Only lighting + security + comms
        else:
            target_loads = [1, 2]                 # Emergency only: life_safety + comms

        # Shed loads that need to be dropped (highest priority number first)
        loads_to_shed = set(self._active_loads) - set(target_loads)
        for load_priority in sorted(loads_to_shed, reverse=True):
            logger.warning("blackstart_load_shedding",
                           priority=load_priority,
                           load_type=LOAD_PRIORITIES.get(load_priority),
                           soc=soc)
            self._active_loads.remove(load_priority)
            await self._notify_event("load_shed", {
                "priority": load_priority,
                "load_type": LOAD_PRIORITIES.get(load_priority),
                "soc": soc,
            })

    async def _start_island_transfer(self) -> None:
        """Send Modbus commands to switch to island mode."""
        if self._write_coil:
            await self._write_coil("grid_contactor", False)    # Open grid
            await asyncio.sleep(0.1)                            # 100ms pause
            await self._write_coil("backup_contactor", True)   # Close backup

    async def _start_grid_reconnect(self) -> None:
        """Send Modbus commands to reconnect to grid (soft transfer)."""
        if self._write_coil:
            await self._write_coil("backup_contactor", False)  # Open backup
            await asyncio.sleep(0.2)
            await self._write_coil("grid_contactor", True)     # Reconnect grid

    async def _notify_event(self, event: str, data: dict) -> None:
        if self._notify:
            await self._notify(event, {
                "site_id": self._site_id,
                "state": self._state.value,
                **data,
            })
