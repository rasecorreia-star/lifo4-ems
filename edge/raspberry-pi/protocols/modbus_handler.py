"""
Modbus RTU/TCP Handler for BMS Communication
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

try:
    from pymodbus.client import AsyncModbusSerialClient, AsyncModbusTcpClient
    from pymodbus.exceptions import ModbusException
    PYMODBUS_AVAILABLE = True
except ImportError:
    PYMODBUS_AVAILABLE = False

logger = logging.getLogger(__name__)


# Register maps for common BMS systems
BMS_REGISTER_MAPS = {
    "daly": {
        "total_voltage": {"address": 0x00, "count": 1, "scale": 0.1, "unit": "V"},
        "current": {"address": 0x01, "count": 1, "scale": 0.1, "offset": -3000, "unit": "A"},
        "soc": {"address": 0x02, "count": 1, "scale": 0.1, "unit": "%"},
        "max_cell_voltage": {"address": 0x03, "count": 1, "scale": 0.001, "unit": "V"},
        "min_cell_voltage": {"address": 0x04, "count": 1, "scale": 0.001, "unit": "V"},
        "cell_voltages_start": {"address": 0x10, "count": 16, "scale": 0.001, "unit": "V"},
        "temperatures_start": {"address": 0x20, "count": 4, "scale": 1, "offset": -40, "unit": "C"},
        "cycle_count": {"address": 0x30, "count": 1, "scale": 1, "unit": ""},
        "soh": {"address": 0x31, "count": 1, "scale": 0.1, "unit": "%"},
        "alarms": {"address": 0x40, "count": 1, "scale": 1, "unit": ""},
    },
    "jbd": {
        "total_voltage": {"address": 0x00, "count": 1, "scale": 0.01, "unit": "V"},
        "current": {"address": 0x01, "count": 1, "scale": 0.01, "signed": True, "unit": "A"},
        "remaining_capacity": {"address": 0x02, "count": 1, "scale": 0.01, "unit": "Ah"},
        "nominal_capacity": {"address": 0x03, "count": 1, "scale": 0.01, "unit": "Ah"},
        "cycle_count": {"address": 0x04, "count": 1, "scale": 1, "unit": ""},
        "cell_voltages_start": {"address": 0x10, "count": 16, "scale": 0.001, "unit": "V"},
        "temperatures_start": {"address": 0x30, "count": 4, "scale": 0.1, "offset": -273.15, "unit": "C"},
    },
}


class ModbusHandler:
    """Handles Modbus RTU communication with BMS devices."""

    def __init__(
        self,
        port: str = "/dev/ttyUSB0",
        baudrate: int = 9600,
        timeout: float = 1.0,
        method: str = "rtu",  # rtu or tcp
        host: str = None,
        tcp_port: int = 502,
    ):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.method = method
        self.host = host
        self.tcp_port = tcp_port

        self.client = None
        self.is_connected = False

        # Device configuration
        self.devices: Dict[str, dict] = {}

    async def connect(self) -> bool:
        """Connect to Modbus device."""
        if not PYMODBUS_AVAILABLE:
            logger.error("pymodbus not available")
            return False

        try:
            if self.method == "rtu":
                self.client = AsyncModbusSerialClient(
                    port=self.port,
                    baudrate=self.baudrate,
                    timeout=self.timeout,
                    parity="N",
                    stopbits=1,
                    bytesize=8,
                )
            else:
                self.client = AsyncModbusTcpClient(
                    host=self.host,
                    port=self.tcp_port,
                    timeout=self.timeout,
                )

            connected = await self.client.connect()

            if connected:
                self.is_connected = True
                logger.info(f"Modbus connected: {self.port if self.method == 'rtu' else self.host}")
                return True
            else:
                logger.error("Modbus connection failed")
                return False

        except Exception as e:
            logger.error(f"Modbus connection error: {e}")
            return False

    async def disconnect(self):
        """Disconnect from Modbus device."""
        if self.client:
            self.client.close()
            self.is_connected = False
            logger.info("Modbus disconnected")

    def register_device(
        self,
        device_id: str,
        slave_id: int,
        bms_type: str = "daly",
        cell_count: int = 16,
        temp_sensors: int = 4,
    ):
        """Register a BMS device."""
        self.devices[device_id] = {
            "slave_id": slave_id,
            "bms_type": bms_type,
            "cell_count": cell_count,
            "temp_sensors": temp_sensors,
            "register_map": BMS_REGISTER_MAPS.get(bms_type, BMS_REGISTER_MAPS["daly"]),
        }
        logger.info(f"Registered device: {device_id} (slave {slave_id}, type {bms_type})")

    async def read_bms_data(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Read all BMS data from a device."""
        if not self.is_connected or not self.client:
            return None

        device = self.devices.get(device_id)
        if not device:
            logger.warning(f"Device not registered: {device_id}")
            return None

        slave_id = device["slave_id"]
        register_map = device["register_map"]

        data = {
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            # Read basic registers
            for name, reg in register_map.items():
                if name.endswith("_start"):
                    continue  # Handle array reads separately

                value = await self._read_register(
                    slave_id,
                    reg["address"],
                    reg["count"],
                    reg.get("scale", 1),
                    reg.get("offset", 0),
                    reg.get("signed", False),
                )

                if value is not None:
                    data[name] = value

            # Read cell voltages
            if "cell_voltages_start" in register_map:
                reg = register_map["cell_voltages_start"]
                cells = await self._read_registers(
                    slave_id,
                    reg["address"],
                    device["cell_count"],
                    reg.get("scale", 0.001),
                )
                if cells:
                    data["cells"] = [
                        {"index": i, "voltage": v, "status": "normal"}
                        for i, v in enumerate(cells)
                    ]
                    data["min_cell_voltage"] = min(cells)
                    data["max_cell_voltage"] = max(cells)
                    data["avg_cell_voltage"] = sum(cells) / len(cells)
                    data["cell_delta"] = max(cells) - min(cells)

            # Read temperatures
            if "temperatures_start" in register_map:
                reg = register_map["temperatures_start"]
                temps = await self._read_registers(
                    slave_id,
                    reg["address"],
                    device["temp_sensors"],
                    reg.get("scale", 1),
                    reg.get("offset", 0),
                )
                if temps:
                    data["temperature"] = {
                        "sensors": temps,
                        "min": min(temps),
                        "max": max(temps),
                        "average": sum(temps) / len(temps),
                    }

            # Calculate derived values
            if "total_voltage" in data and "current" in data:
                data["power"] = data["total_voltage"] * data["current"]

            data["is_charging"] = data.get("current", 0) > 0.5
            data["is_discharging"] = data.get("current", 0) < -0.5

            return data

        except Exception as e:
            logger.error(f"Error reading BMS data from {device_id}: {e}")
            return None

    async def _read_register(
        self,
        slave_id: int,
        address: int,
        count: int = 1,
        scale: float = 1,
        offset: float = 0,
        signed: bool = False,
    ) -> Optional[float]:
        """Read a single register or register pair."""
        try:
            result = await self.client.read_holding_registers(
                address=address,
                count=count,
                slave=slave_id,
            )

            if result.isError():
                return None

            if count == 1:
                value = result.registers[0]
                if signed and value > 32767:
                    value -= 65536
            else:
                # 32-bit value
                value = (result.registers[0] << 16) | result.registers[1]

            return value * scale + offset

        except Exception as e:
            logger.debug(f"Register read error: {e}")
            return None

    async def _read_registers(
        self,
        slave_id: int,
        address: int,
        count: int,
        scale: float = 1,
        offset: float = 0,
    ) -> Optional[List[float]]:
        """Read multiple consecutive registers."""
        try:
            result = await self.client.read_holding_registers(
                address=address,
                count=count,
                slave=slave_id,
            )

            if result.isError():
                return None

            return [v * scale + offset for v in result.registers]

        except Exception as e:
            logger.debug(f"Registers read error: {e}")
            return None

    async def send_command(self, device_id: str, command: dict) -> bool:
        """Send command to BMS device."""
        device = self.devices.get(device_id)
        if not device or not self.is_connected:
            return False

        slave_id = device["slave_id"]
        cmd_type = command.get("command")

        try:
            if cmd_type == "set_charge":
                # Example: Write to charge enable register
                await self.client.write_register(
                    address=0x80,
                    value=1 if command.get("enable", True) else 0,
                    slave=slave_id,
                )
                return True

            elif cmd_type == "set_discharge":
                await self.client.write_register(
                    address=0x81,
                    value=1 if command.get("enable", True) else 0,
                    slave=slave_id,
                )
                return True

            elif cmd_type == "reset_alarms":
                await self.client.write_register(
                    address=0x90,
                    value=1,
                    slave=slave_id,
                )
                return True

            else:
                logger.warning(f"Unknown command: {cmd_type}")
                return False

        except Exception as e:
            logger.error(f"Command error: {e}")
            return False
