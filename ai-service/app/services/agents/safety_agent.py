"""
Safety Agent
Critical agent responsible for safety monitoring, protection, and emergency responses.
"""

import asyncio
from typing import Dict, Any, Optional, List, Set, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentMessage,
    AgentPriority,
    MessageType
)

logger = logging.getLogger(__name__)


class SafetyLevel(Enum):
    """Safety severity levels"""
    NORMAL = 0
    ADVISORY = 1
    WARNING = 2
    ALARM = 3
    CRITICAL = 4
    EMERGENCY = 5


class SafetyZone(Enum):
    """Safety monitoring zones"""
    CELL = "cell"
    MODULE = "module"
    RACK = "rack"
    SYSTEM = "system"
    PCS = "pcs"
    THERMAL = "thermal"
    ELECTRICAL = "electrical"
    ENVIRONMENTAL = "environmental"


class ProtectionAction(Enum):
    """Available protection actions"""
    NONE = "none"
    REDUCE_POWER = "reduce_power"
    STOP_CHARGE = "stop_charge"
    STOP_DISCHARGE = "stop_discharge"
    ISOLATE_MODULE = "isolate_module"
    ISOLATE_RACK = "isolate_rack"
    EMERGENCY_STOP = "emergency_stop"
    ACTIVATE_COOLING = "activate_cooling"
    ACTIVATE_SUPPRESSION = "activate_suppression"
    EVACUATE = "evacuate"


@dataclass
class SafetyThreshold:
    """Safety threshold configuration"""
    parameter: str
    zone: SafetyZone
    warning_low: Optional[float] = None
    warning_high: Optional[float] = None
    alarm_low: Optional[float] = None
    alarm_high: Optional[float] = None
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    action_warning: ProtectionAction = ProtectionAction.NONE
    action_alarm: ProtectionAction = ProtectionAction.REDUCE_POWER
    action_critical: ProtectionAction = ProtectionAction.EMERGENCY_STOP
    hysteresis: float = 0.02  # 2% hysteresis


@dataclass
class SafetyEvent:
    """Safety event record"""
    id: str
    timestamp: datetime
    zone: SafetyZone
    level: SafetyLevel
    parameter: str
    value: float
    threshold: float
    action_taken: ProtectionAction
    message: str
    acknowledged: bool = False
    resolved: bool = False
    resolved_at: Optional[datetime] = None


@dataclass
class ProtectionState:
    """Current protection state"""
    level: SafetyLevel = SafetyLevel.NORMAL
    active_protections: Set[ProtectionAction] = field(default_factory=set)
    locked_out: bool = False
    lockout_reason: str = ""
    last_event: Optional[SafetyEvent] = None


DEFAULT_THRESHOLDS = [
    # Cell voltage thresholds
    SafetyThreshold(
        parameter="cell_voltage",
        zone=SafetyZone.CELL,
        warning_low=2.8, warning_high=3.55,
        alarm_low=2.6, alarm_high=3.6,
        critical_low=2.5, critical_high=3.65,
        action_warning=ProtectionAction.NONE,
        action_alarm=ProtectionAction.REDUCE_POWER,
        action_critical=ProtectionAction.EMERGENCY_STOP
    ),
    # Cell temperature thresholds
    SafetyThreshold(
        parameter="cell_temperature",
        zone=SafetyZone.CELL,
        warning_low=5, warning_high=40,
        alarm_low=0, alarm_high=45,
        critical_low=-10, critical_high=55,
        action_warning=ProtectionAction.ACTIVATE_COOLING,
        action_alarm=ProtectionAction.REDUCE_POWER,
        action_critical=ProtectionAction.EMERGENCY_STOP
    ),
    # Module temperature
    SafetyThreshold(
        parameter="module_temperature",
        zone=SafetyZone.MODULE,
        warning_high=45,
        alarm_high=50,
        critical_high=60,
        action_warning=ProtectionAction.ACTIVATE_COOLING,
        action_alarm=ProtectionAction.REDUCE_POWER,
        action_critical=ProtectionAction.ISOLATE_MODULE
    ),
    # SOC limits
    SafetyThreshold(
        parameter="soc",
        zone=SafetyZone.SYSTEM,
        warning_low=0.1, warning_high=0.95,
        alarm_low=0.05, alarm_high=0.98,
        critical_low=0.02, critical_high=1.0,
        action_warning=ProtectionAction.NONE,
        action_alarm=ProtectionAction.STOP_CHARGE if True else ProtectionAction.STOP_DISCHARGE,
        action_critical=ProtectionAction.EMERGENCY_STOP
    ),
    # Current limits
    SafetyThreshold(
        parameter="current",
        zone=SafetyZone.ELECTRICAL,
        warning_high=450,  # A
        alarm_high=480,
        critical_high=500,
        action_alarm=ProtectionAction.REDUCE_POWER,
        action_critical=ProtectionAction.EMERGENCY_STOP
    ),
    # Insulation resistance
    SafetyThreshold(
        parameter="insulation_resistance",
        zone=SafetyZone.ELECTRICAL,
        warning_low=500,  # kOhm
        alarm_low=100,
        critical_low=50,
        action_alarm=ProtectionAction.REDUCE_POWER,
        action_critical=ProtectionAction.EMERGENCY_STOP
    ),
    # Smoke detection
    SafetyThreshold(
        parameter="smoke_level",
        zone=SafetyZone.ENVIRONMENTAL,
        warning_high=0.1,
        alarm_high=0.3,
        critical_high=0.5,
        action_alarm=ProtectionAction.EMERGENCY_STOP,
        action_critical=ProtectionAction.ACTIVATE_SUPPRESSION
    ),
    # Gas detection (H2, CO)
    SafetyThreshold(
        parameter="gas_concentration",
        zone=SafetyZone.ENVIRONMENTAL,
        warning_high=50,  # ppm
        alarm_high=100,
        critical_high=200,
        action_alarm=ProtectionAction.EMERGENCY_STOP,
        action_critical=ProtectionAction.EVACUATE
    )
]


class SafetyAgent(BaseAgent):
    """
    Critical safety monitoring and protection agent.

    Responsibilities:
    - Continuous monitoring of safety parameters
    - Threshold violation detection
    - Automatic protection actions
    - Event logging and alarming
    - Emergency response coordination
    """

    def __init__(
        self,
        agent_id: str = "safety_agent",
        name: str = "Safety Agent"
    ):
        super().__init__(
            agent_id=agent_id,
            name=name,
            description="Critical safety monitoring and protection agent"
        )

        # Safety thresholds
        self.thresholds: Dict[str, SafetyThreshold] = {}
        self._load_default_thresholds()

        # Current state
        self.protection_state = ProtectionState()

        # Event history
        self.event_history: List[SafetyEvent] = []
        self.max_history = 1000

        # Active alarms
        self.active_alarms: Dict[str, SafetyEvent] = {}

        # Monitoring intervals
        self.monitoring_interval_ms = 100  # 100ms for safety-critical
        self._monitoring_task: Optional[asyncio.Task] = None

        # Emergency callbacks
        self.emergency_callbacks: List[Callable] = []

        # Watchdog
        self._last_heartbeat = datetime.now()
        self._watchdog_timeout_seconds = 5

        # Setup handlers
        self._setup_handlers()

    def _register_capabilities(self):
        """Register safety capabilities"""
        capabilities = [
            AgentCapability(
                name="safety_monitoring",
                description="Continuous monitoring of all safety parameters",
                priority=AgentPriority.CRITICAL
            ),
            AgentCapability(
                name="protection_control",
                description="Execute protection actions based on conditions",
                priority=AgentPriority.CRITICAL
            ),
            AgentCapability(
                name="emergency_stop",
                description="Execute emergency stop sequence",
                priority=AgentPriority.CRITICAL
            ),
            AgentCapability(
                name="threshold_management",
                description="Configure safety thresholds",
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="alarm_management",
                description="Manage active alarms and events",
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="fault_diagnosis",
                description="Diagnose and classify faults",
                priority=AgentPriority.HIGH
            )
        ]

        for cap in capabilities:
            self.register_capability(cap)

    def _setup_handlers(self):
        """Setup message handlers"""
        self.register_handler("telemetry", self._handle_telemetry)
        self.register_handler("emergency_stop", self._handle_emergency_stop)
        self.register_handler("acknowledge_alarm", self._handle_acknowledge_alarm)
        self.register_handler("reset_protection", self._handle_reset_protection)
        self.register_handler("update_threshold", self._handle_update_threshold)
        self.register_handler("get_status", self._handle_get_status)
        self.register_handler("heartbeat", self._handle_heartbeat)

        # Subscribe to all safety-relevant topics
        self.subscribe("bess/telemetry")
        self.subscribe("bms/cell_data")
        self.subscribe("thermal/status")
        self.subscribe("pcs/status")
        self.subscribe("environment/sensors")

    def _load_default_thresholds(self):
        """Load default safety thresholds"""
        for threshold in DEFAULT_THRESHOLDS:
            key = f"{threshold.zone.value}_{threshold.parameter}"
            self.thresholds[key] = threshold

    async def start(self):
        """Start safety agent with monitoring task"""
        await super().start()

        # Start continuous monitoring
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())

        logger.info(f"Safety Agent started with {len(self.thresholds)} thresholds")

    async def stop(self):
        """Stop safety agent"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        await super().stop()

    async def _monitoring_loop(self):
        """Continuous safety monitoring loop"""
        while self._running:
            try:
                # Check watchdog
                await self._check_watchdog()

                # Process any pending safety checks
                await self._process_safety_checks()

                await asyncio.sleep(self.monitoring_interval_ms / 1000)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Safety monitoring error: {e}")
                # Don't sleep on error - safety is critical
                self.metrics.error_count += 1

    async def _process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process safety tasks"""
        task_type = task.get('type', '')

        if task_type == 'check_parameters':
            return await self._check_parameters(task.get('parameters', {}))
        elif task_type == 'execute_protection':
            return await self._execute_protection(task.get('action'))
        elif task_type == 'diagnose_fault':
            return await self._diagnose_fault(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}

    async def _handle_telemetry(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle incoming telemetry data"""
        payload = message.payload

        # Extract parameters from telemetry
        parameters = {}

        # Cell-level data
        if 'cells' in payload:
            for cell in payload['cells']:
                parameters[f"cell_{cell['id']}_voltage"] = {
                    'value': cell.get('voltage'),
                    'zone': SafetyZone.CELL,
                    'parameter': 'cell_voltage'
                }
                parameters[f"cell_{cell['id']}_temperature"] = {
                    'value': cell.get('temperature'),
                    'zone': SafetyZone.CELL,
                    'parameter': 'cell_temperature'
                }

        # Module-level data
        if 'modules' in payload:
            for module in payload['modules']:
                parameters[f"module_{module['id']}_temperature"] = {
                    'value': module.get('temperature'),
                    'zone': SafetyZone.MODULE,
                    'parameter': 'module_temperature'
                }

        # System-level data
        if 'system' in payload:
            sys_data = payload['system']
            parameters['system_soc'] = {
                'value': sys_data.get('soc'),
                'zone': SafetyZone.SYSTEM,
                'parameter': 'soc'
            }
            parameters['system_current'] = {
                'value': sys_data.get('current'),
                'zone': SafetyZone.ELECTRICAL,
                'parameter': 'current'
            }

        # Environmental data
        if 'environment' in payload:
            env_data = payload['environment']
            if 'smoke_level' in env_data:
                parameters['smoke_level'] = {
                    'value': env_data['smoke_level'],
                    'zone': SafetyZone.ENVIRONMENTAL,
                    'parameter': 'smoke_level'
                }
            if 'gas_concentration' in env_data:
                parameters['gas_concentration'] = {
                    'value': env_data['gas_concentration'],
                    'zone': SafetyZone.ENVIRONMENTAL,
                    'parameter': 'gas_concentration'
                }

        # Check all parameters
        result = await self._check_parameters(parameters)

        return result

    async def _check_parameters(self, parameters: Dict[str, Dict]) -> Dict[str, Any]:
        """Check parameters against safety thresholds"""
        violations = []
        highest_level = SafetyLevel.NORMAL

        for param_id, param_data in parameters.items():
            value = param_data.get('value')
            if value is None:
                continue

            zone = param_data.get('zone', SafetyZone.SYSTEM)
            param_name = param_data.get('parameter', param_id)

            # Find matching threshold
            threshold_key = f"{zone.value}_{param_name}"
            threshold = self.thresholds.get(threshold_key)

            if not threshold:
                continue

            # Check threshold violations
            level, violation = self._check_threshold(value, threshold)

            if level.value > SafetyLevel.NORMAL.value:
                violations.append({
                    'parameter': param_id,
                    'value': value,
                    'level': level.value,
                    'level_name': level.name,
                    'violation': violation
                })

                if level.value > highest_level.value:
                    highest_level = level

                # Create event and take action
                await self._handle_violation(param_id, value, threshold, level, violation)

        # Update protection state
        self.protection_state.level = highest_level

        return {
            'success': True,
            'safety_level': highest_level.name,
            'violations': violations,
            'active_protections': [p.value for p in self.protection_state.active_protections]
        }

    def _check_threshold(
        self,
        value: float,
        threshold: SafetyThreshold
    ) -> tuple[SafetyLevel, str]:
        """Check value against threshold and return level and violation type"""
        # Check critical first (highest priority)
        if threshold.critical_high is not None and value >= threshold.critical_high:
            return SafetyLevel.CRITICAL, "high"
        if threshold.critical_low is not None and value <= threshold.critical_low:
            return SafetyLevel.CRITICAL, "low"

        # Check alarm
        if threshold.alarm_high is not None and value >= threshold.alarm_high:
            return SafetyLevel.ALARM, "high"
        if threshold.alarm_low is not None and value <= threshold.alarm_low:
            return SafetyLevel.ALARM, "low"

        # Check warning
        if threshold.warning_high is not None and value >= threshold.warning_high:
            return SafetyLevel.WARNING, "high"
        if threshold.warning_low is not None and value <= threshold.warning_low:
            return SafetyLevel.WARNING, "low"

        return SafetyLevel.NORMAL, ""

    async def _handle_violation(
        self,
        param_id: str,
        value: float,
        threshold: SafetyThreshold,
        level: SafetyLevel,
        violation: str
    ):
        """Handle a threshold violation"""
        # Determine action
        if level == SafetyLevel.CRITICAL:
            action = threshold.action_critical
        elif level == SafetyLevel.ALARM:
            action = threshold.action_alarm
        else:
            action = threshold.action_warning

        # Create event
        event = SafetyEvent(
            id=f"{param_id}_{datetime.now().timestamp()}",
            timestamp=datetime.now(),
            zone=threshold.zone,
            level=level,
            parameter=threshold.parameter,
            value=value,
            threshold=getattr(threshold, f"{level.name.lower()}_{violation}") or 0,
            action_taken=action,
            message=f"{threshold.parameter} {violation} threshold exceeded: {value}"
        )

        # Add to history
        self.event_history.append(event)
        if len(self.event_history) > self.max_history:
            self.event_history = self.event_history[-self.max_history:]

        # Add to active alarms if alarm or higher
        if level.value >= SafetyLevel.ALARM.value:
            self.active_alarms[param_id] = event

        # Update protection state
        self.protection_state.last_event = event

        # Execute protection action
        if action != ProtectionAction.NONE:
            await self._execute_protection(action)

        # Send alert message
        await self._send_alert(event)

        logger.warning(
            f"Safety violation: {event.message} - Action: {action.value}"
        )

    async def _execute_protection(self, action: ProtectionAction) -> Dict[str, Any]:
        """Execute a protection action"""
        if action == ProtectionAction.NONE:
            return {'success': True, 'action': 'none'}

        # Add to active protections
        self.protection_state.active_protections.add(action)

        result = {'success': True, 'action': action.value}

        if action == ProtectionAction.EMERGENCY_STOP:
            result.update(await self._emergency_stop())

        elif action == ProtectionAction.REDUCE_POWER:
            result['command'] = {
                'type': 'power_limit',
                'value': 0.5  # Reduce to 50%
            }
            await self._send_command('pcs', 'reduce_power', {'factor': 0.5})

        elif action == ProtectionAction.STOP_CHARGE:
            result['command'] = {'type': 'stop_charge'}
            await self._send_command('pcs', 'stop_charge', {})

        elif action == ProtectionAction.STOP_DISCHARGE:
            result['command'] = {'type': 'stop_discharge'}
            await self._send_command('pcs', 'stop_discharge', {})

        elif action == ProtectionAction.ISOLATE_MODULE:
            result['command'] = {'type': 'isolate_module'}
            await self._send_command('bms', 'isolate_module', {})

        elif action == ProtectionAction.ISOLATE_RACK:
            result['command'] = {'type': 'isolate_rack'}
            await self._send_command('bms', 'isolate_rack', {})

        elif action == ProtectionAction.ACTIVATE_COOLING:
            result['command'] = {'type': 'activate_cooling', 'mode': 'emergency'}
            await self._send_command('thermal', 'activate_cooling', {'mode': 'emergency'})

        elif action == ProtectionAction.ACTIVATE_SUPPRESSION:
            result['command'] = {'type': 'fire_suppression'}
            await self._send_command('fire_system', 'activate', {})
            # Also trigger emergency stop
            await self._emergency_stop()

        elif action == ProtectionAction.EVACUATE:
            result['command'] = {'type': 'evacuate'}
            await self._send_command('building', 'evacuate', {})
            # Also trigger emergency stop and suppression
            await self._emergency_stop()
            await self._send_command('fire_system', 'activate', {})

        logger.warning(f"Protection action executed: {action.value}")

        return result

    async def _emergency_stop(self) -> Dict[str, Any]:
        """Execute emergency stop sequence"""
        logger.critical("EMERGENCY STOP INITIATED")

        # Lock out system
        self.protection_state.locked_out = True
        self.protection_state.lockout_reason = "Emergency stop"

        # Send stop commands to all systems
        commands = [
            self._send_command('pcs', 'emergency_stop', {}),
            self._send_command('bms', 'emergency_disconnect', {}),
            self._send_command('thermal', 'emergency_mode', {}),
        ]

        await asyncio.gather(*commands, return_exceptions=True)

        # Call emergency callbacks
        for callback in self.emergency_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    callback()
            except Exception as e:
                logger.error(f"Emergency callback error: {e}")

        # Create emergency event
        event = SafetyEvent(
            id=f"emergency_{datetime.now().timestamp()}",
            timestamp=datetime.now(),
            zone=SafetyZone.SYSTEM,
            level=SafetyLevel.EMERGENCY,
            parameter="emergency_stop",
            value=1.0,
            threshold=0.0,
            action_taken=ProtectionAction.EMERGENCY_STOP,
            message="Emergency stop executed"
        )

        self.event_history.append(event)
        self.active_alarms['emergency_stop'] = event

        return {
            'success': True,
            'action': 'emergency_stop',
            'locked_out': True,
            'timestamp': datetime.now().isoformat()
        }

    async def _send_command(self, target: str, command: str, params: Dict[str, Any]):
        """Send command to another system via message"""
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id=f"{target}_agent",
            message_type=MessageType.COMMAND,
            priority=AgentPriority.CRITICAL,
            topic=command,
            payload=params
        )

        await self.send_message(message)

    async def _send_alert(self, event: SafetyEvent):
        """Send alert notification"""
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id="",  # Broadcast
            message_type=MessageType.ALERT,
            priority=AgentPriority.CRITICAL if event.level.value >= SafetyLevel.ALARM.value else AgentPriority.HIGH,
            topic="safety_alert",
            payload={
                'event_id': event.id,
                'level': event.level.name,
                'zone': event.zone.value,
                'parameter': event.parameter,
                'value': event.value,
                'message': event.message,
                'action': event.action_taken.value,
                'timestamp': event.timestamp.isoformat()
            }
        )

        await self.send_message(message)

    async def _handle_emergency_stop(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle emergency stop request"""
        return await self._emergency_stop()

    async def _handle_acknowledge_alarm(self, message: AgentMessage) -> Dict[str, Any]:
        """Acknowledge an active alarm"""
        alarm_id = message.payload.get('alarm_id')
        user = message.payload.get('user', 'unknown')

        if alarm_id in self.active_alarms:
            self.active_alarms[alarm_id].acknowledged = True
            logger.info(f"Alarm {alarm_id} acknowledged by {user}")
            return {'success': True, 'alarm_id': alarm_id, 'acknowledged': True}
        else:
            return {'success': False, 'error': f'Alarm {alarm_id} not found'}

    async def _handle_reset_protection(self, message: AgentMessage) -> Dict[str, Any]:
        """Reset protection state (requires confirmation)"""
        confirmed = message.payload.get('confirmed', False)
        user = message.payload.get('user', 'unknown')

        if not confirmed:
            return {'success': False, 'error': 'Confirmation required'}

        # Check if conditions are safe
        if self.protection_state.level.value >= SafetyLevel.ALARM.value:
            return {
                'success': False,
                'error': 'Cannot reset - active alarm conditions exist',
                'level': self.protection_state.level.name
            }

        # Reset state
        self.protection_state.locked_out = False
        self.protection_state.lockout_reason = ""
        self.protection_state.active_protections.clear()

        logger.info(f"Protection state reset by {user}")

        return {
            'success': True,
            'reset': True,
            'user': user,
            'timestamp': datetime.now().isoformat()
        }

    async def _handle_update_threshold(self, message: AgentMessage) -> Dict[str, Any]:
        """Update a safety threshold"""
        payload = message.payload

        zone = SafetyZone(payload.get('zone', 'system'))
        parameter = payload.get('parameter')

        if not parameter:
            return {'success': False, 'error': 'Parameter required'}

        threshold_key = f"{zone.value}_{parameter}"

        if threshold_key in self.thresholds:
            threshold = self.thresholds[threshold_key]

            # Update values
            for attr in ['warning_low', 'warning_high', 'alarm_low', 'alarm_high',
                        'critical_low', 'critical_high', 'hysteresis']:
                if attr in payload:
                    setattr(threshold, attr, payload[attr])

            return {'success': True, 'threshold_key': threshold_key, 'updated': True}
        else:
            # Create new threshold
            new_threshold = SafetyThreshold(
                parameter=parameter,
                zone=zone,
                **{k: v for k, v in payload.items() if k not in ['zone', 'parameter']}
            )
            self.thresholds[threshold_key] = new_threshold

            return {'success': True, 'threshold_key': threshold_key, 'created': True}

    async def _handle_get_status(self, message: AgentMessage) -> Dict[str, Any]:
        """Get current safety status"""
        return self.get_safety_status()

    async def _handle_heartbeat(self, message: AgentMessage) -> Dict[str, Any]:
        """Handle heartbeat message"""
        self._last_heartbeat = datetime.now()
        return {'success': True, 'alive': True}

    async def _check_watchdog(self):
        """Check watchdog timer"""
        elapsed = (datetime.now() - self._last_heartbeat).total_seconds()

        if elapsed > self._watchdog_timeout_seconds:
            logger.error(f"Safety watchdog timeout: {elapsed:.1f}s since last heartbeat")

            # Create watchdog event
            event = SafetyEvent(
                id=f"watchdog_{datetime.now().timestamp()}",
                timestamp=datetime.now(),
                zone=SafetyZone.SYSTEM,
                level=SafetyLevel.ALARM,
                parameter="watchdog",
                value=elapsed,
                threshold=self._watchdog_timeout_seconds,
                action_taken=ProtectionAction.NONE,
                message=f"Watchdog timeout: {elapsed:.1f}s"
            )

            self.event_history.append(event)
            await self._send_alert(event)

    async def _process_safety_checks(self):
        """Process periodic safety checks"""
        # Check for any parameters that need re-evaluation
        current_beliefs = self.beliefs.copy()

        for key, value in current_beliefs.items():
            if key.startswith('param_'):
                # Re-check parameter
                pass  # Would be populated from actual sensor data

    async def _diagnose_fault(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Diagnose a fault based on symptoms"""
        symptoms = task.get('symptoms', [])

        diagnosis = {
            'possible_causes': [],
            'severity': SafetyLevel.NORMAL.name,
            'recommended_actions': []
        }

        # Simple rule-based diagnosis
        if 'high_cell_voltage' in symptoms and 'high_temperature' in symptoms:
            diagnosis['possible_causes'].append('Overcharging with thermal runaway risk')
            diagnosis['severity'] = SafetyLevel.CRITICAL.name
            diagnosis['recommended_actions'] = [
                ProtectionAction.EMERGENCY_STOP.value,
                ProtectionAction.ACTIVATE_COOLING.value
            ]

        elif 'low_cell_voltage' in symptoms:
            diagnosis['possible_causes'].append('Over-discharge or cell failure')
            diagnosis['severity'] = SafetyLevel.ALARM.name
            diagnosis['recommended_actions'] = [
                ProtectionAction.STOP_DISCHARGE.value,
                ProtectionAction.ISOLATE_MODULE.value
            ]

        elif 'high_temperature' in symptoms:
            diagnosis['possible_causes'].append('Cooling system failure or high ambient')
            diagnosis['severity'] = SafetyLevel.WARNING.name
            diagnosis['recommended_actions'] = [
                ProtectionAction.ACTIVATE_COOLING.value,
                ProtectionAction.REDUCE_POWER.value
            ]

        elif 'smoke_detected' in symptoms:
            diagnosis['possible_causes'].append('Thermal event or fire')
            diagnosis['severity'] = SafetyLevel.EMERGENCY.name
            diagnosis['recommended_actions'] = [
                ProtectionAction.EMERGENCY_STOP.value,
                ProtectionAction.ACTIVATE_SUPPRESSION.value,
                ProtectionAction.EVACUATE.value
            ]

        return diagnosis

    def get_safety_status(self) -> Dict[str, Any]:
        """Get comprehensive safety status"""
        return {
            'agent_id': self.agent_id,
            'state': self.state.value,
            'safety_level': self.protection_state.level.name,
            'locked_out': self.protection_state.locked_out,
            'lockout_reason': self.protection_state.lockout_reason,
            'active_protections': [p.value for p in self.protection_state.active_protections],
            'active_alarms': {
                k: {
                    'level': v.level.name,
                    'message': v.message,
                    'acknowledged': v.acknowledged,
                    'timestamp': v.timestamp.isoformat()
                }
                for k, v in self.active_alarms.items()
            },
            'total_events': len(self.event_history),
            'thresholds_configured': len(self.thresholds),
            'watchdog_status': {
                'last_heartbeat': self._last_heartbeat.isoformat(),
                'timeout_seconds': self._watchdog_timeout_seconds
            }
        }

    def register_emergency_callback(self, callback: Callable):
        """Register callback for emergency events"""
        self.emergency_callbacks.append(callback)

    def get_event_history(
        self,
        level: Optional[SafetyLevel] = None,
        zone: Optional[SafetyZone] = None,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get filtered event history"""
        events = self.event_history

        if level:
            events = [e for e in events if e.level.value >= level.value]

        if zone:
            events = [e for e in events if e.zone == zone]

        if since:
            events = [e for e in events if e.timestamp >= since]

        # Sort by timestamp descending and limit
        events = sorted(events, key=lambda x: x.timestamp, reverse=True)[:limit]

        return [
            {
                'id': e.id,
                'timestamp': e.timestamp.isoformat(),
                'zone': e.zone.value,
                'level': e.level.name,
                'parameter': e.parameter,
                'value': e.value,
                'threshold': e.threshold,
                'action': e.action_taken.value,
                'message': e.message,
                'acknowledged': e.acknowledged,
                'resolved': e.resolved
            }
            for e in events
        ]
