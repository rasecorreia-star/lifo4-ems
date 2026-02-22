"""
BMS Simulator — emulates a LiFePO4 battery via Modbus TCP.
Essential for development and testing without real hardware.

Usage:
    python scripts/simulate_bms.py --scenario normal
    python scripts/simulate_bms.py --scenario solar-peak
    python scripts/simulate_bms.py --scenario grid-failure
    python scripts/simulate_bms.py --scenario hot-day
    python scripts/simulate_bms.py --scenario degraded-cell
    python scripts/simulate_bms.py --scenario full-charge
    python scripts/simulate_bms.py --scenario empty
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import math
import struct
import time
from dataclasses import dataclass

from pymodbus.datastore import ModbusSequentialDataBlock, ModbusSlaveContext, ModbusServerContext
from pymodbus.server import StartAsyncTcpServer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bms-simulator")


@dataclass
class BatteryState:
    soc: float = 50.0              # %
    soh: float = 98.5              # %
    voltage: float = 48.0          # V (48V system)
    current: float = 0.0           # A
    power_kw: float = 0.0          # kW
    temp_min: float = 25.0         # °C
    temp_max: float = 27.0         # °C
    temp_avg: float = 26.0         # °C
    frequency: float = 60.0        # Hz
    grid_voltage: float = 220.0    # V
    cell_voltage_min: float = 3.20  # V
    cell_voltage_max: float = 3.22  # V
    capacity_kwh: float = 100.0
    max_power_kw: float = 50.0


SCENARIOS: dict[str, dict] = {
    "normal": {
        "soc": 50.0, "temp_max": 27.0, "frequency": 60.0, "cell_voltage_min": 3.20,
    },
    "solar-peak": {
        "soc": 75.0, "temp_max": 32.0, "frequency": 60.02, "current": 80.0,
    },
    "grid-failure": {
        "soc": 60.0, "frequency": 48.5, "grid_voltage": 160.0, "temp_max": 28.0,
    },
    "hot-day": {
        "soc": 45.0, "temp_max": 47.0, "temp_avg": 44.0, "frequency": 60.0,
    },
    "degraded-cell": {
        "soc": 50.0, "cell_voltage_min": 3.05, "cell_voltage_max": 3.22, "soh": 92.0,
    },
    "full-charge": {
        "soc": 96.0, "cell_voltage_max": 3.64, "temp_max": 30.0,
    },
    "empty": {
        "soc": 7.0, "cell_voltage_min": 2.55, "temp_max": 26.0,
    },
}


def _float_to_registers(value: float) -> list[int]:
    """Encode float32 as two 16-bit Modbus registers."""
    raw = struct.pack(">f", float(value))
    r1, r2 = struct.unpack(">HH", raw)
    return [r1, r2]


def _uint_to_registers(value: int) -> list[int]:
    return [int(value) & 0xFFFF]


def _build_register_block(state: BatteryState) -> list[int]:
    """
    Build input register block from state.
    Register layout matches config/modbus-map.yaml.
    """
    regs = [0] * 512

    def wr(addr: int, values: list[int]) -> None:
        for i, v in enumerate(values):
            regs[addr + i] = v

    # 0x0100 = 256
    wr(0x0100, _float_to_registers(state.soc))
    wr(0x0102, _float_to_registers(state.soh))
    wr(0x0104, _float_to_registers(state.voltage))
    wr(0x0106, _float_to_registers(state.current))
    wr(0x0108, _float_to_registers(state.power_kw))
    wr(0x010A, _float_to_registers(state.temp_min))
    wr(0x010C, _float_to_registers(state.temp_max))
    wr(0x010E, _float_to_registers(state.temp_avg))
    wr(0x0110, _float_to_registers(state.frequency))
    wr(0x0112, _float_to_registers(state.grid_voltage))
    wr(0x0114, _float_to_registers(state.cell_voltage_min))
    wr(0x0116, _float_to_registers(state.cell_voltage_max))
    wr(0x0118, _uint_to_registers(16))  # 16 cells

    return regs


async def _simulate_physics(state: BatteryState, context: ModbusServerContext, scenario: str) -> None:
    """Update battery state over time based on commanded power."""
    scenario_params = SCENARIOS.get(scenario, SCENARIOS["normal"])
    for key, val in scenario_params.items():
        if hasattr(state, key):
            setattr(state, key, val)

    logger.info(f"BMS Simulator running — scenario: {scenario}")
    logger.info(f"Initial SOC: {state.soc:.1f}%")

    t = 0
    while True:
        await asyncio.sleep(1)
        t += 1

        # Read commanded power from holding registers (address 0x0000)
        try:
            regs = context[0].getValues(3, 0x0000, count=2)  # Function code 3 = holding regs
            raw = struct.pack(">HH", regs[0], regs[1])
            commanded_power = struct.unpack(">f", raw)[0]
        except Exception:
            commanded_power = 0.0

        # Physics simulation (1 second tick)
        if abs(commanded_power) > 0.1:
            # Energy delta in kWh for 1 second
            energy_kwh = commanded_power / 3600.0
            delta_soc = (energy_kwh / state.capacity_kwh) * 100.0
            state.soc = max(0.0, min(100.0, state.soc + delta_soc))
            state.power_kw = commanded_power
            state.current = commanded_power * 1000.0 / state.voltage

            # Temperature rises with power
            heat = abs(commanded_power) * 0.001
            state.temp_max = min(60.0, state.temp_max + heat)
            state.temp_avg = state.temp_max - 2.0
        else:
            state.power_kw = 0.0
            state.current = 0.0
            # Temperature dissipates
            state.temp_max = max(25.0, state.temp_max - 0.1)
            state.temp_avg = state.temp_max - 2.0

        # Cell voltages follow SOC
        cell_v = 2.8 + (state.soc / 100.0) * 0.8
        if scenario == "degraded-cell":
            state.cell_voltage_min = max(2.5, cell_v - 0.17)
        else:
            state.cell_voltage_min = cell_v - 0.02
        state.cell_voltage_max = cell_v + 0.02

        # Grid frequency oscillation
        if scenario == "grid-failure":
            state.frequency = 48.5 + math.sin(t * 0.1) * 0.3
        else:
            state.frequency = 60.0 + math.sin(t * 0.05) * 0.02

        # Update registers
        block = _build_register_block(state)
        context[0].setValues(4, 0, block)  # Function code 4 = input registers

        if t % 10 == 0:
            logger.info(
                f"SOC={state.soc:.1f}% | "
                f"Power={state.power_kw:.1f}kW | "
                f"Temp={state.temp_max:.1f}°C | "
                f"Freq={state.frequency:.2f}Hz"
            )


async def run_simulator(scenario: str, port: int = 5020) -> None:
    """Start Modbus TCP server simulating a BMS."""
    state = BatteryState()
    initial = SCENARIOS.get(scenario, SCENARIOS["normal"])
    for key, val in initial.items():
        if hasattr(state, key):
            setattr(state, key, val)

    # Build initial register block
    block = _build_register_block(state)

    store = ModbusSlaveContext(
        di=ModbusSequentialDataBlock(0, [0] * 512),
        co=ModbusSequentialDataBlock(0, [0] * 512),
        hr=ModbusSequentialDataBlock(0, [0] * 512),
        ir=ModbusSequentialDataBlock(0, block),
    )
    context = ModbusServerContext(slaves=store, single=True)

    logger.info(f"BMS Simulator starting on port {port} — scenario: {scenario}")

    # Run physics simulation in background
    asyncio.create_task(_simulate_physics(state, context, scenario))

    await StartAsyncTcpServer(context=context, address=("0.0.0.0", port))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LIFO4 BMS Simulator")
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()),
        default="normal",
        help="Simulation scenario",
    )
    parser.add_argument("--port", type=int, default=5020, help="Modbus TCP port")
    args = parser.parse_args()

    asyncio.run(run_simulator(args.scenario, args.port))
