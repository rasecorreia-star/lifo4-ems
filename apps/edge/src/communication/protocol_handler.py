"""
Protocol handler abstraction.
Normalizes data from different protocols (Modbus TCP/RTU, CAN) into
a unified TelemetrySnapshot format.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from src.communication.modbus_client import ModbusClient
from src.config import ModbusConfig
from src.safety.safety_manager import TelemetrySnapshot
from src.utils.logger import get_logger

logger = get_logger(__name__)


class Protocol(Enum):
    MODBUS_TCP = "modbus_tcp"
    MODBUS_RTU = "modbus_rtu"
    CAN = "can"         # Future: CAN bus support


class ProtocolHandler:
    """
    Unified interface for reading telemetry and writing commands,
    regardless of the underlying communication protocol.
    Currently supports Modbus TCP/RTU. CAN planned for future.
    """

    def __init__(self, config: ModbusConfig, site_id: str):
        self._protocol = Protocol.MODBUS_TCP if config.mode == "tcp" else Protocol.MODBUS_RTU
        self._modbus = ModbusClient(config, site_id)
        logger.info("protocol_handler_initialized", protocol=self._protocol.value)

    async def connect(self) -> bool:
        return await self._modbus.connect()

    async def disconnect(self) -> None:
        await self._modbus.disconnect()

    async def read_telemetry(self) -> Optional[TelemetrySnapshot]:
        return await self._modbus.read_telemetry()

    async def set_power(self, power_kw: float) -> bool:
        """Set power setpoint (kW). Positive = charge, negative = discharge."""
        return await self._modbus.write_power_setpoint(power_kw)

    async def emergency_stop(self) -> bool:
        return await self._modbus.emergency_stop()

    async def set_charge_enable(self, enabled: bool) -> bool:
        return await self._modbus.write_coil("charge_enable", enabled)

    async def set_discharge_enable(self, enabled: bool) -> bool:
        return await self._modbus.write_coil("discharge_enable", enabled)

    async def set_grid_contactor(self, closed: bool) -> bool:
        """Control grid contactor for black start operation."""
        return await self._modbus.write_coil("grid_contactor", closed)

    async def set_backup_contactor(self, closed: bool) -> bool:
        """Control backup load contactor for island mode."""
        return await self._modbus.write_coil("backup_contactor", closed)
