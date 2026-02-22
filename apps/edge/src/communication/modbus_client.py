"""
Modbus TCP/RTU client for BMS communication.
Supports configurable register maps, retry with backoff, and async operation.
"""
from __future__ import annotations

import asyncio
import struct
from pathlib import Path
from typing import Any

import yaml
from pymodbus.client import AsyncModbusTcpClient, AsyncModbusSerialClient
from pymodbus.exceptions import ModbusException

from src.config import ModbusConfig
from src.safety.safety_manager import TelemetrySnapshot
from src.utils.logger import get_logger
from src.utils.metrics import MODBUS_ERRORS_TOTAL

logger = get_logger(__name__)


def _decode_float32(registers: list[int]) -> float:
    """Decode two 16-bit Modbus registers into IEEE 754 float32."""
    raw = struct.pack(">HH", registers[0], registers[1])
    return struct.unpack(">f", raw)[0]


def _decode_uint16(registers: list[int]) -> int:
    return registers[0]


class ModbusClient:
    """
    Async Modbus client supporting TCP and RTU modes.
    Loads register map from YAML configuration.
    """

    def __init__(self, config: ModbusConfig, site_id: str):
        self._config = config
        self._site_id = site_id
        self._client: Any = None
        self._register_map: dict = {}
        self._connected = False
        self._load_register_map()

    def _load_register_map(self) -> None:
        map_path = Path(self._config.register_map)
        if not map_path.exists():
            # Try relative to project root
            map_path = Path(__file__).parent.parent.parent / self._config.register_map
        if map_path.exists():
            with open(map_path) as f:
                data = yaml.safe_load(f)
                self._register_map = data.get("registers", {})
        else:
            logger.warning("modbus_map_not_found", path=str(map_path))

    async def connect(self) -> bool:
        """Establish Modbus connection."""
        try:
            if self._config.mode == "tcp":
                self._client = AsyncModbusTcpClient(
                    host=self._config.host,
                    port=self._config.port,
                    timeout=self._config.timeout_ms / 1000,
                )
            else:
                self._client = AsyncModbusSerialClient(
                    port=self._config.serial_port,
                    baudrate=self._config.baud_rate,
                    timeout=self._config.timeout_ms / 1000,
                )
            await self._client.connect()
            self._connected = self._client.connected
            logger.info("modbus_connected", mode=self._config.mode, connected=self._connected)
            return self._connected
        except Exception as e:
            logger.error("modbus_connect_failed", error=str(e))
            return False

    async def disconnect(self) -> None:
        if self._client:
            self._client.close()
            self._connected = False
            logger.info("modbus_disconnected")

    async def _read_with_retry(self, address: int, count: int) -> list[int] | None:
        """Read registers with exponential backoff retry."""
        for attempt in range(self._config.retry_count):
            try:
                result = await self._client.read_input_registers(
                    address=address,
                    count=count,
                    slave=self._config.unit_id,
                )
                if not result.isError():
                    return result.registers
                raise ModbusException(f"Error response: {result}")
            except Exception as e:
                delay = (self._config.retry_delay_ms / 1000) * (2 ** attempt)
                logger.warning(
                    "modbus_read_retry",
                    attempt=attempt + 1,
                    address=hex(address),
                    error=str(e),
                    retry_delay=delay,
                )
                MODBUS_ERRORS_TOTAL.labels(site_id=self._site_id).inc()
                if attempt < self._config.retry_count - 1:
                    await asyncio.sleep(delay)
        return None

    async def read_telemetry(self) -> TelemetrySnapshot | None:
        """Read all telemetry registers and return a TelemetrySnapshot."""
        if not self._connected:
            if not await self.connect():
                return None

        try:
            telemetry_regs = self._register_map.get("telemetry", {})

            async def read_float(reg_name: str, default: float = 0.0) -> float:
                reg = telemetry_regs.get(reg_name)
                if not reg:
                    return default
                regs = await self._read_with_retry(reg["address"], 2)
                if regs is None:
                    return default
                raw = _decode_float32(regs)
                return raw * reg.get("scale", 1.0)

            async def read_uint(reg_name: str, default: int = 0) -> int:
                reg = telemetry_regs.get(reg_name)
                if not reg:
                    return default
                regs = await self._read_with_retry(reg["address"], 1)
                if regs is None:
                    return default
                return _decode_uint16(regs)

            soc = await read_float("soc", 50.0)
            soh = await read_float("soh", 100.0)
            voltage = await read_float("voltage", 48.0)
            current = await read_float("current", 0.0)
            power = await read_float("power", 0.0)
            temp_min = await read_float("temp_min", 25.0)
            temp_max = await read_float("temp_max", 25.0)
            temp_avg = await read_float("temp_avg", 25.0)
            frequency = await read_float("frequency", 60.0)
            grid_voltage = await read_float("grid_voltage", 220.0)
            cell_v_min = await read_float("cell_voltage_min", 3.2)
            cell_v_max = await read_float("cell_voltage_max", 3.2)

            return TelemetrySnapshot(
                soc=soc,
                soh=soh,
                voltage=voltage,
                current=current,
                power_kw=power,
                temp_min=temp_min,
                temp_max=temp_max,
                temp_avg=temp_avg,
                frequency=frequency,
                grid_voltage=grid_voltage,
                cell_voltage_min=cell_v_min,
                cell_voltage_max=cell_v_max,
            )

        except Exception as e:
            logger.error("modbus_read_telemetry_failed", error=str(e))
            MODBUS_ERRORS_TOTAL.labels(site_id=self._site_id).inc()
            self._connected = False
            return None

    async def write_power_setpoint(self, power_kw: float) -> bool:
        """Write power setpoint to BMS (kW, + charge, - discharge)."""
        if not self._connected:
            if not await self.connect():
                return False
        try:
            cmd_regs = self._register_map.get("commands", {})
            reg = cmd_regs.get("set_power")
            if not reg:
                logger.error("modbus_no_set_power_register")
                return False

            # Encode float32 as two 16-bit registers
            raw = struct.pack(">f", float(power_kw))
            r1, r2 = struct.unpack(">HH", raw)
            result = await self._client.write_registers(
                address=reg["address"],
                values=[r1, r2],
                slave=self._config.unit_id,
            )
            if result.isError():
                logger.error("modbus_write_power_failed", power_kw=power_kw)
                return False
            logger.info("modbus_power_setpoint_written", power_kw=power_kw)
            return True
        except Exception as e:
            logger.error("modbus_write_failed", error=str(e))
            self._connected = False
            return False

    async def write_coil(self, coil_name: str, value: bool) -> bool:
        """Write a boolean coil (e.g., emergency_stop, charge_enable)."""
        if not self._connected:
            if not await self.connect():
                return False
        try:
            cmd_regs = self._register_map.get("commands", {})
            reg = cmd_regs.get(coil_name)
            if not reg:
                logger.error("modbus_coil_not_found", coil=coil_name)
                return False
            result = await self._client.write_coil(
                address=reg["address"],
                value=value,
                slave=self._config.unit_id,
            )
            logger.info("modbus_coil_written", coil=coil_name, value=value)
            return not result.isError()
        except Exception as e:
            logger.error("modbus_coil_write_failed", coil=coil_name, error=str(e))
            self._connected = False
            return False

    async def emergency_stop(self) -> bool:
        """Send emergency stop command — highest priority."""
        logger.critical("modbus_emergency_stop_sent")
        return await self.write_coil("emergency_stop", True)
