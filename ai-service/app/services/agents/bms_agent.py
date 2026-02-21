"""
BMS Agent
Manages Battery Management System interactions and cell-level monitoring.
"""

import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging
import numpy as np

from .base_agent import (
    BaseAgent, AgentMessage, AgentCapability, AgentPriority, MessageType
)

logger = logging.getLogger(__name__)


class CellStatus(Enum):
    """Individual cell status"""
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    FAULT = "fault"
    DISCONNECTED = "disconnected"


class BalancingMode(Enum):
    """Cell balancing modes"""
    PASSIVE = "passive"
    ACTIVE = "active"
    OFF = "off"


@dataclass
class CellData:
    """Data for a single cell"""
    cell_id: str
    voltage: float  # V
    temperature: float  # °C
    soc: float  # %
    soh: float  # %
    internal_resistance: float  # mOhm
    status: CellStatus = CellStatus.NORMAL
    balancing: bool = False
    cycle_count: int = 0
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ModuleData:
    """Data for a battery module"""
    module_id: str
    cells: List[CellData]
    total_voltage: float
    average_temp: float
    min_cell_voltage: float
    max_cell_voltage: float
    voltage_delta: float
    status: CellStatus = CellStatus.NORMAL


@dataclass
class PackData:
    """Data for a battery pack"""
    pack_id: str
    modules: List[ModuleData]
    total_voltage: float
    total_current: float
    soc: float
    soh: float
    power: float
    energy_available: float
    temperature_min: float
    temperature_max: float
    temperature_avg: float


class BMSAgent(BaseAgent):
    """
    Battery Management System Agent.

    Responsibilities:
    - Monitor cell-level data (voltage, temperature, SOC)
    - Cell balancing decisions
    - Fault detection at cell/module level
    - SOC/SOH estimation
    - Thermal management recommendations
    """

    def __init__(self, agent_id: str = "bms-agent"):
        super().__init__(
            agent_id=agent_id,
            name="BMS Agent",
            description="Manages battery cells and modules"
        )

        # BMS-specific state
        self.packs: Dict[str, PackData] = {}
        self.cell_history: Dict[str, List[CellData]] = {}
        self.balancing_active = False

        # Thresholds
        self.voltage_limits = {
            'min': 2.5,  # V
            'max': 3.65,  # V
            'warning_low': 2.8,
            'warning_high': 3.55
        }
        self.temp_limits = {
            'min': -20,  # °C
            'max': 60,
            'warning_low': 0,
            'warning_high': 45,
            'optimal_min': 20,
            'optimal_max': 35
        }
        self.balance_threshold = 0.02  # V - trigger balancing if delta > this

        # Subscribe to relevant topics
        self.subscribe("telemetry.cells")
        self.subscribe("command.balancing")
        self.subscribe("query.bms_status")

    def _register_capabilities(self):
        """Register BMS agent capabilities"""
        self.register_capability(AgentCapability(
            name="cell_monitoring",
            description="Monitor individual cell voltages, temperatures, and health",
            priority=AgentPriority.HIGH
        ))

        self.register_capability(AgentCapability(
            name="soc_estimation",
            description="Estimate State of Charge using multiple methods",
            priority=AgentPriority.HIGH
        ))

        self.register_capability(AgentCapability(
            name="soh_estimation",
            description="Estimate State of Health and remaining capacity",
            priority=AgentPriority.NORMAL
        ))

        self.register_capability(AgentCapability(
            name="cell_balancing",
            description="Manage passive/active cell balancing",
            priority=AgentPriority.NORMAL
        ))

        self.register_capability(AgentCapability(
            name="thermal_monitoring",
            description="Monitor thermal conditions and gradients",
            priority=AgentPriority.HIGH
        ))

        self.register_capability(AgentCapability(
            name="fault_detection",
            description="Detect cell and module level faults",
            priority=AgentPriority.CRITICAL
        ))

        # Register message handlers
        self.register_handler("telemetry.cells", self._handle_cell_telemetry)
        self.register_handler("command.balancing", self._handle_balancing_command)
        self.register_handler("query.bms_status", self._handle_status_query)
        self.register_handler("query.soc", self._handle_soc_query)
        self.register_handler("query.soh", self._handle_soh_query)

    async def _process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process BMS-specific tasks"""
        task_type = task.get('type', '')

        if task_type == 'analyze_pack':
            return await self._analyze_pack(task.get('pack_id'))
        elif task_type == 'balance_cells':
            return await self._balance_cells(task.get('pack_id'))
        elif task_type == 'estimate_soc':
            return await self._estimate_soc(task.get('pack_id'))
        elif task_type == 'detect_faults':
            return await self._detect_faults(task.get('pack_id'))
        else:
            return {'error': f'Unknown task type: {task_type}'}

    async def _handle_cell_telemetry(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle incoming cell telemetry data"""
        payload = message.payload
        pack_id = payload.get('pack_id')

        if not pack_id:
            return {'error': 'Missing pack_id'}

        # Parse cell data
        cells_data = payload.get('cells', [])
        modules_data = payload.get('modules', [])

        # Update internal state
        modules = []
        for mod_data in modules_data:
            cells = [
                CellData(
                    cell_id=c['id'],
                    voltage=c['voltage'],
                    temperature=c['temperature'],
                    soc=c.get('soc', 50),
                    soh=c.get('soh', 100),
                    internal_resistance=c.get('resistance', 1.0),
                    status=CellStatus(c.get('status', 'normal'))
                )
                for c in mod_data.get('cells', [])
            ]

            if cells:
                voltages = [c.voltage for c in cells]
                temps = [c.temperature for c in cells]

                module = ModuleData(
                    module_id=mod_data['id'],
                    cells=cells,
                    total_voltage=sum(voltages),
                    average_temp=np.mean(temps),
                    min_cell_voltage=min(voltages),
                    max_cell_voltage=max(voltages),
                    voltage_delta=max(voltages) - min(voltages),
                    status=self._determine_module_status(cells)
                )
                modules.append(module)

        if modules:
            all_voltages = [c.voltage for m in modules for c in m.cells]
            all_temps = [c.temperature for m in modules for c in m.cells]

            pack = PackData(
                pack_id=pack_id,
                modules=modules,
                total_voltage=sum(m.total_voltage for m in modules),
                total_current=payload.get('current', 0),
                soc=payload.get('soc', 50),
                soh=payload.get('soh', 100),
                power=payload.get('power', 0),
                energy_available=payload.get('energy', 0),
                temperature_min=min(all_temps),
                temperature_max=max(all_temps),
                temperature_avg=np.mean(all_temps)
            )

            self.packs[pack_id] = pack
            self.update_belief('last_update', datetime.now())

            # Check for issues
            alerts = await self._check_alerts(pack)
            if alerts:
                await self._send_alerts(alerts)

        return {'status': 'ok', 'pack_id': pack_id}

    async def _handle_balancing_command(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle balancing control commands"""
        command = message.payload.get('command')
        pack_id = message.payload.get('pack_id')

        if command == 'start':
            self.balancing_active = True
            return {'status': 'balancing_started', 'pack_id': pack_id}
        elif command == 'stop':
            self.balancing_active = False
            return {'status': 'balancing_stopped', 'pack_id': pack_id}
        elif command == 'auto':
            return await self._balance_cells(pack_id)

        return {'error': f'Unknown command: {command}'}

    async def _handle_status_query(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle BMS status queries"""
        pack_id = message.payload.get('pack_id')

        if pack_id and pack_id in self.packs:
            pack = self.packs[pack_id]
            return {
                'pack_id': pack_id,
                'total_voltage': pack.total_voltage,
                'current': pack.total_current,
                'soc': pack.soc,
                'soh': pack.soh,
                'power': pack.power,
                'temperature': {
                    'min': pack.temperature_min,
                    'max': pack.temperature_max,
                    'avg': pack.temperature_avg
                },
                'modules': len(pack.modules),
                'balancing_active': self.balancing_active
            }

        # Return all packs summary
        return {
            'packs': {
                pid: {
                    'voltage': p.total_voltage,
                    'soc': p.soc,
                    'soh': p.soh
                }
                for pid, p in self.packs.items()
            }
        }

    async def _handle_soc_query(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle SOC estimation query"""
        pack_id = message.payload.get('pack_id')
        return await self._estimate_soc(pack_id)

    async def _handle_soh_query(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle SOH estimation query"""
        pack_id = message.payload.get('pack_id')
        return await self._estimate_soh(pack_id)

    def _determine_module_status(self, cells: List[CellData]) -> CellStatus:
        """Determine module status based on cells"""
        statuses = [c.status for c in cells]

        if CellStatus.FAULT in statuses:
            return CellStatus.FAULT
        if CellStatus.CRITICAL in statuses:
            return CellStatus.CRITICAL
        if CellStatus.WARNING in statuses:
            return CellStatus.WARNING
        return CellStatus.NORMAL

    async def _check_alerts(self, pack: PackData) -> List[Dict[str, Any]]:
        """Check for alert conditions"""
        alerts = []

        for module in pack.modules:
            for cell in module.cells:
                # Voltage alerts
                if cell.voltage < self.voltage_limits['min']:
                    alerts.append({
                        'type': 'voltage_critical_low',
                        'cell_id': cell.cell_id,
                        'module_id': module.module_id,
                        'value': cell.voltage,
                        'threshold': self.voltage_limits['min'],
                        'severity': 'critical'
                    })
                elif cell.voltage > self.voltage_limits['max']:
                    alerts.append({
                        'type': 'voltage_critical_high',
                        'cell_id': cell.cell_id,
                        'module_id': module.module_id,
                        'value': cell.voltage,
                        'threshold': self.voltage_limits['max'],
                        'severity': 'critical'
                    })

                # Temperature alerts
                if cell.temperature > self.temp_limits['max']:
                    alerts.append({
                        'type': 'temperature_critical_high',
                        'cell_id': cell.cell_id,
                        'module_id': module.module_id,
                        'value': cell.temperature,
                        'threshold': self.temp_limits['max'],
                        'severity': 'critical'
                    })
                elif cell.temperature < self.temp_limits['min']:
                    alerts.append({
                        'type': 'temperature_critical_low',
                        'cell_id': cell.cell_id,
                        'module_id': module.module_id,
                        'value': cell.temperature,
                        'threshold': self.temp_limits['min'],
                        'severity': 'critical'
                    })

            # Module voltage imbalance
            if module.voltage_delta > self.balance_threshold * 2:
                alerts.append({
                    'type': 'voltage_imbalance',
                    'module_id': module.module_id,
                    'delta': module.voltage_delta,
                    'threshold': self.balance_threshold,
                    'severity': 'warning'
                })

        return alerts

    async def _send_alerts(self, alerts: List[Dict[str, Any]]):
        """Send alerts to coordinator/safety agent"""
        for alert in alerts:
            message = AgentMessage(
                message_type=MessageType.ALERT,
                topic="bms.alert",
                priority=AgentPriority.CRITICAL if alert['severity'] == 'critical' else AgentPriority.HIGH,
                payload=alert
            )
            await self.send_message(message)

    async def _analyze_pack(self, pack_id: str) -> Dict[str, Any]:
        """Analyze pack health and performance"""
        if pack_id not in self.packs:
            return {'error': f'Pack not found: {pack_id}'}

        pack = self.packs[pack_id]

        # Cell statistics
        all_voltages = [c.voltage for m in pack.modules for c in m.cells]
        all_temps = [c.temperature for m in pack.modules for c in m.cells]
        all_resistances = [c.internal_resistance for m in pack.modules for c in m.cells]

        analysis = {
            'pack_id': pack_id,
            'voltage': {
                'total': pack.total_voltage,
                'cell_avg': np.mean(all_voltages),
                'cell_min': min(all_voltages),
                'cell_max': max(all_voltages),
                'std_dev': np.std(all_voltages),
                'imbalance': max(all_voltages) - min(all_voltages)
            },
            'temperature': {
                'min': pack.temperature_min,
                'max': pack.temperature_max,
                'avg': pack.temperature_avg,
                'gradient': pack.temperature_max - pack.temperature_min,
                'std_dev': np.std(all_temps)
            },
            'resistance': {
                'avg': np.mean(all_resistances),
                'min': min(all_resistances),
                'max': max(all_resistances),
                'std_dev': np.std(all_resistances)
            },
            'health': {
                'soc': pack.soc,
                'soh': pack.soh,
                'needs_balancing': (max(all_voltages) - min(all_voltages)) > self.balance_threshold,
                'thermal_status': self._get_thermal_status(pack)
            },
            'recommendations': self._get_recommendations(pack)
        }

        return analysis

    def _get_thermal_status(self, pack: PackData) -> str:
        """Get thermal status assessment"""
        if pack.temperature_max > self.temp_limits['warning_high']:
            return 'high'
        if pack.temperature_min < self.temp_limits['warning_low']:
            return 'low'
        if (self.temp_limits['optimal_min'] <= pack.temperature_avg <= self.temp_limits['optimal_max']):
            return 'optimal'
        return 'acceptable'

    def _get_recommendations(self, pack: PackData) -> List[str]:
        """Get operational recommendations"""
        recommendations = []

        all_voltages = [c.voltage for m in pack.modules for c in m.cells]
        voltage_delta = max(all_voltages) - min(all_voltages)

        if voltage_delta > self.balance_threshold:
            recommendations.append(f"Cell balancing recommended (delta: {voltage_delta:.3f}V)")

        if pack.temperature_max > self.temp_limits['warning_high']:
            recommendations.append(f"Reduce power to lower temperature (max: {pack.temperature_max}°C)")

        if pack.temperature_max - pack.temperature_min > 10:
            recommendations.append("Check cooling system - high thermal gradient detected")

        if pack.soh < 80:
            recommendations.append("Battery degradation significant - consider capacity reduction")

        return recommendations

    async def _balance_cells(self, pack_id: str) -> Dict[str, Any]:
        """Execute cell balancing"""
        if pack_id not in self.packs:
            return {'error': f'Pack not found: {pack_id}'}

        pack = self.packs[pack_id]
        cells_to_balance = []

        for module in pack.modules:
            voltages = [c.voltage for c in module.cells]
            target_voltage = min(voltages) + self.balance_threshold / 2

            for cell in module.cells:
                if cell.voltage > target_voltage + self.balance_threshold / 2:
                    cells_to_balance.append({
                        'cell_id': cell.cell_id,
                        'module_id': module.module_id,
                        'current_voltage': cell.voltage,
                        'target_voltage': target_voltage,
                        'balance_needed': cell.voltage - target_voltage
                    })

        return {
            'pack_id': pack_id,
            'cells_to_balance': len(cells_to_balance),
            'balancing_plan': cells_to_balance,
            'estimated_duration_minutes': len(cells_to_balance) * 5
        }

    async def _estimate_soc(self, pack_id: str) -> Dict[str, Any]:
        """Estimate State of Charge using multiple methods"""
        if pack_id not in self.packs:
            return {'error': f'Pack not found: {pack_id}'}

        pack = self.packs[pack_id]

        # Voltage-based SOC (OCV method)
        all_voltages = [c.voltage for m in pack.modules for c in m.cells]
        avg_voltage = np.mean(all_voltages)

        # Simple linear mapping for LiFePO4 (3.0V = 0%, 3.4V = 100%)
        voltage_soc = max(0, min(100, (avg_voltage - 3.0) / (3.4 - 3.0) * 100))

        # Coulomb counting would require current integration
        # Using pack's reported SOC as reference
        coulomb_soc = pack.soc

        # Kalman filter combination (simplified weighted average)
        estimated_soc = 0.3 * voltage_soc + 0.7 * coulomb_soc

        return {
            'pack_id': pack_id,
            'soc': estimated_soc,
            'methods': {
                'voltage_based': voltage_soc,
                'coulomb_counting': coulomb_soc,
                'combined': estimated_soc
            },
            'confidence': 0.85,
            'timestamp': datetime.now().isoformat()
        }

    async def _estimate_soh(self, pack_id: str) -> Dict[str, Any]:
        """Estimate State of Health"""
        if pack_id not in self.packs:
            return {'error': f'Pack not found: {pack_id}'}

        pack = self.packs[pack_id]

        # Resistance-based SOH
        all_resistances = [c.internal_resistance for m in pack.modules for c in m.cells]
        avg_resistance = np.mean(all_resistances)

        # Assuming fresh cell resistance is 1.0 mOhm, EOL is 2.0 mOhm
        resistance_soh = max(0, min(100, (2.0 - avg_resistance) / (2.0 - 1.0) * 100))

        # Capacity-based (using pack reported SOH)
        capacity_soh = pack.soh

        # Combined estimate
        estimated_soh = 0.4 * resistance_soh + 0.6 * capacity_soh

        return {
            'pack_id': pack_id,
            'soh': estimated_soh,
            'methods': {
                'resistance_based': resistance_soh,
                'capacity_based': capacity_soh,
                'combined': estimated_soh
            },
            'remaining_cycles': int(estimated_soh / 100 * 3500),  # Assuming 3500 cycle life
            'degradation_rate': (100 - estimated_soh) / max(1, pack.modules[0].cells[0].cycle_count if pack.modules else 1),
            'timestamp': datetime.now().isoformat()
        }

    async def _detect_faults(self, pack_id: str) -> Dict[str, Any]:
        """Detect potential faults"""
        if pack_id not in self.packs:
            return {'error': f'Pack not found: {pack_id}'}

        pack = self.packs[pack_id]
        faults = []

        for module in pack.modules:
            for cell in module.cells:
                # Over/under voltage
                if cell.voltage < self.voltage_limits['min']:
                    faults.append({
                        'type': 'undervoltage',
                        'severity': 'critical',
                        'cell_id': cell.cell_id,
                        'value': cell.voltage
                    })
                if cell.voltage > self.voltage_limits['max']:
                    faults.append({
                        'type': 'overvoltage',
                        'severity': 'critical',
                        'cell_id': cell.cell_id,
                        'value': cell.voltage
                    })

                # Temperature faults
                if cell.temperature > self.temp_limits['max']:
                    faults.append({
                        'type': 'overtemperature',
                        'severity': 'critical',
                        'cell_id': cell.cell_id,
                        'value': cell.temperature
                    })

                # High resistance (degraded cell)
                if cell.internal_resistance > 2.5:
                    faults.append({
                        'type': 'high_resistance',
                        'severity': 'warning',
                        'cell_id': cell.cell_id,
                        'value': cell.internal_resistance
                    })

        return {
            'pack_id': pack_id,
            'faults_detected': len(faults),
            'faults': faults,
            'overall_status': 'critical' if any(f['severity'] == 'critical' for f in faults)
                             else 'warning' if faults else 'normal',
            'timestamp': datetime.now().isoformat()
        }
