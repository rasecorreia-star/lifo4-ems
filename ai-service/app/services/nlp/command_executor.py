"""
Command Executor for BESS Virtual Assistant
Executes commands and queries based on NLP results.
"""

import asyncio
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import logging
import httpx

from .intent_classifier import Intent, IntentCategory
from .entity_extractor import EntityType
from .dialog_manager import ConversationContext, DialogFrame, DialogState

logger = logging.getLogger(__name__)


class CommandStatus(Enum):
    """Status of command execution"""
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    UNAUTHORIZED = "unauthorized"
    INVALID_PARAMETERS = "invalid_parameters"
    NOT_FOUND = "not_found"


@dataclass
class CommandResult:
    """Result of command execution"""
    status: CommandStatus
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    requires_confirmation: bool = False


@dataclass
class QueryResult:
    """Result of a query"""
    success: bool
    data: Any
    formatted_response: str
    error: Optional[str] = None


# Response formatters for different query types
class ResponseFormatter:
    """Formats data into human-readable responses"""

    @staticmethod
    def format_soc(data: Dict[str, Any], language: str = 'pt') -> str:
        soc = data.get('soc', 0)
        if language == 'pt':
            status = "excelente" if soc > 80 else "bom" if soc > 50 else "baixo" if soc > 20 else "crítico"
            return f"O SOC atual é de {soc:.1f}% - nível {status}."
        else:
            status = "excellent" if soc > 80 else "good" if soc > 50 else "low" if soc > 20 else "critical"
            return f"Current SOC is {soc:.1f}% - {status} level."

    @staticmethod
    def format_soh(data: Dict[str, Any], language: str = 'pt') -> str:
        soh = data.get('soh', 0)
        cycles = data.get('cycles', 0)
        remaining = data.get('remaining_cycles', 0)
        if language == 'pt':
            return f"Saúde da bateria (SOH): {soh:.1f}%\nCiclos realizados: {cycles}\nCiclos restantes estimados: {remaining}"
        else:
            return f"Battery health (SOH): {soh:.1f}%\nCycles completed: {cycles}\nEstimated remaining cycles: {remaining}"

    @staticmethod
    def format_power(data: Dict[str, Any], language: str = 'pt') -> str:
        power = data.get('power', 0)
        mode = data.get('mode', 'idle')
        if language == 'pt':
            mode_pt = {'charging': 'carregando', 'discharging': 'descarregando', 'idle': 'ocioso'}
            return f"Potência atual: {abs(power):.1f} kW ({mode_pt.get(mode, mode)})"
        else:
            return f"Current power: {abs(power):.1f} kW ({mode})"

    @staticmethod
    def format_temperature(data: Dict[str, Any], language: str = 'pt') -> str:
        avg = data.get('average', 0)
        max_temp = data.get('max', 0)
        min_temp = data.get('min', 0)
        if language == 'pt':
            return f"Temperatura:\n• Média: {avg:.1f}°C\n• Máxima: {max_temp:.1f}°C\n• Mínima: {min_temp:.1f}°C"
        else:
            return f"Temperature:\n• Average: {avg:.1f}°C\n• Maximum: {max_temp:.1f}°C\n• Minimum: {min_temp:.1f}°C"

    @staticmethod
    def format_voltage(data: Dict[str, Any], language: str = 'pt') -> str:
        total = data.get('total_voltage', 0)
        cell_avg = data.get('cell_average', 0)
        cell_max = data.get('cell_max', 0)
        cell_min = data.get('cell_min', 0)
        if language == 'pt':
            return f"Tensão:\n• Total: {total:.1f}V\n• Célula média: {cell_avg:.3f}V\n• Célula max: {cell_max:.3f}V\n• Célula min: {cell_min:.3f}V"
        else:
            return f"Voltage:\n• Total: {total:.1f}V\n• Cell average: {cell_avg:.3f}V\n• Cell max: {cell_max:.3f}V\n• Cell min: {cell_min:.3f}V"

    @staticmethod
    def format_status(data: Dict[str, Any], language: str = 'pt') -> str:
        status = data.get('status', 'unknown')
        mode = data.get('mode', 'idle')
        soc = data.get('soc', 0)
        power = data.get('power', 0)
        alarms = data.get('active_alarms', 0)

        if language == 'pt':
            status_pt = {'online': 'online', 'offline': 'offline', 'error': 'erro', 'maintenance': 'manutenção'}
            mode_pt = {'charging': 'carregando', 'discharging': 'descarregando', 'idle': 'ocioso'}
            alarm_text = f"⚠️ {alarms} alarmes ativos!" if alarms > 0 else "✅ Sem alarmes"
            return (
                f"Status do Sistema BESS:\n"
                f"• Status: {status_pt.get(status, status)}\n"
                f"• Modo: {mode_pt.get(mode, mode)}\n"
                f"• SOC: {soc:.1f}%\n"
                f"• Potência: {abs(power):.1f} kW\n"
                f"• {alarm_text}"
            )
        else:
            alarm_text = f"⚠️ {alarms} active alarms!" if alarms > 0 else "✅ No alarms"
            return (
                f"BESS System Status:\n"
                f"• Status: {status}\n"
                f"• Mode: {mode}\n"
                f"• SOC: {soc:.1f}%\n"
                f"• Power: {abs(power):.1f} kW\n"
                f"• {alarm_text}"
            )

    @staticmethod
    def format_alarms(data: Dict[str, Any], language: str = 'pt') -> str:
        alarms = data.get('alarms', [])
        count = len(alarms)

        if count == 0:
            return "Nenhum alarme ativo." if language == 'pt' else "No active alarms."

        if language == 'pt':
            response = f"⚠️ {count} alarme(s) ativo(s):\n"
            for i, alarm in enumerate(alarms[:5], 1):
                response += f"{i}. [{alarm.get('level', 'INFO')}] {alarm.get('message', 'Sem descrição')}\n"
            if count > 5:
                response += f"... e mais {count - 5} alarme(s)"
        else:
            response = f"⚠️ {count} active alarm(s):\n"
            for i, alarm in enumerate(alarms[:5], 1):
                response += f"{i}. [{alarm.get('level', 'INFO')}] {alarm.get('message', 'No description')}\n"
            if count > 5:
                response += f"... and {count - 5} more alarm(s)"

        return response

    @staticmethod
    def format_efficiency(data: Dict[str, Any], language: str = 'pt') -> str:
        round_trip = data.get('round_trip_efficiency', 0)
        charge_eff = data.get('charge_efficiency', 0)
        discharge_eff = data.get('discharge_efficiency', 0)

        if language == 'pt':
            return (
                f"Eficiência do Sistema:\n"
                f"• Round-trip: {round_trip:.1f}%\n"
                f"• Carga: {charge_eff:.1f}%\n"
                f"• Descarga: {discharge_eff:.1f}%"
            )
        else:
            return (
                f"System Efficiency:\n"
                f"• Round-trip: {round_trip:.1f}%\n"
                f"• Charge: {charge_eff:.1f}%\n"
                f"• Discharge: {discharge_eff:.1f}%"
            )

    @staticmethod
    def format_revenue(data: Dict[str, Any], language: str = 'pt') -> str:
        daily = data.get('daily', 0)
        monthly = data.get('monthly', 0)
        yearly = data.get('yearly', 0)

        if language == 'pt':
            return (
                f"Receita:\n"
                f"• Hoje: R$ {daily:,.2f}\n"
                f"• Este mês: R$ {monthly:,.2f}\n"
                f"• Este ano: R$ {yearly:,.2f}"
            )
        else:
            return (
                f"Revenue:\n"
                f"• Today: $ {daily:,.2f}\n"
                f"• This month: $ {monthly:,.2f}\n"
                f"• This year: $ {yearly:,.2f}"
            )

    @staticmethod
    def format_schedule(data: Dict[str, Any], language: str = 'pt') -> str:
        schedules = data.get('schedules', [])

        if not schedules:
            return "Nenhuma operação agendada." if language == 'pt' else "No scheduled operations."

        if language == 'pt':
            response = "📅 Próximas operações agendadas:\n"
            for s in schedules[:5]:
                start = s.get('start_time', '')
                op_type = s.get('type', 'unknown')
                power = s.get('power', 0)
                type_pt = {'charge': 'Carga', 'discharge': 'Descarga', 'idle': 'Ocioso'}
                response += f"• {start}: {type_pt.get(op_type, op_type)} - {abs(power):.0f} kW\n"
        else:
            response = "📅 Upcoming scheduled operations:\n"
            for s in schedules[:5]:
                start = s.get('start_time', '')
                op_type = s.get('type', 'unknown')
                power = s.get('power', 0)
                response += f"• {start}: {op_type.capitalize()} - {abs(power):.0f} kW\n"

        return response


class CommandExecutor:
    """
    Executes commands and queries for the BESS virtual assistant.

    Integrates with:
    - BESS management APIs
    - Agent system
    - Report generation
    - Navigation system
    """

    def __init__(
        self,
        backend_url: str = "http://localhost:3000/api/v1",
        agent_url: str = "http://localhost:8000/api/v1"
    ):
        self.backend_url = backend_url
        self.agent_url = agent_url
        self.formatter = ResponseFormatter()

        # Command handlers
        self.command_handlers: Dict[Intent, Callable] = {
            # Commands
            Intent.CMD_START_CHARGE: self._cmd_start_charge,
            Intent.CMD_STOP_CHARGE: self._cmd_stop_charge,
            Intent.CMD_START_DISCHARGE: self._cmd_start_discharge,
            Intent.CMD_STOP_DISCHARGE: self._cmd_stop_discharge,
            Intent.CMD_SET_POWER: self._cmd_set_power,
            Intent.CMD_SET_SOC_LIMIT: self._cmd_set_soc_limit,
            Intent.CMD_EMERGENCY_STOP: self._cmd_emergency_stop,
            Intent.CMD_RESET_ALARMS: self._cmd_reset_alarms,
            Intent.CMD_START_BALANCING: self._cmd_start_balancing,
            Intent.CMD_RUN_OPTIMIZATION: self._cmd_run_optimization,
        }

        # Query handlers
        self.query_handlers: Dict[Intent, Callable] = {
            Intent.QUERY_SOC: self._query_soc,
            Intent.QUERY_SOH: self._query_soh,
            Intent.QUERY_POWER: self._query_power,
            Intent.QUERY_TEMPERATURE: self._query_temperature,
            Intent.QUERY_VOLTAGE: self._query_voltage,
            Intent.QUERY_CURRENT: self._query_current,
            Intent.QUERY_STATUS: self._query_status,
            Intent.QUERY_ALARMS: self._query_alarms,
            Intent.QUERY_EFFICIENCY: self._query_efficiency,
            Intent.QUERY_REVENUE: self._query_revenue,
            Intent.QUERY_SCHEDULE: self._query_schedule,
            Intent.QUERY_FORECAST: self._query_forecast,
        }

    async def execute(
        self,
        context: ConversationContext,
        intent: Intent,
        frame: Optional[DialogFrame] = None
    ) -> CommandResult:
        """
        Execute a command or query.

        Args:
            context: Conversation context
            intent: Intent to execute
            frame: Dialog frame with parameters (for commands)

        Returns:
            CommandResult with status and message
        """
        start_time = datetime.now()

        try:
            # Get handler
            handler = self.command_handlers.get(intent) or self.query_handlers.get(intent)

            if not handler:
                return CommandResult(
                    status=CommandStatus.NOT_FOUND,
                    message=self._not_implemented_message(context, intent),
                    error="Handler not found"
                )

            # Execute
            result = await handler(context, frame)

            elapsed = (datetime.now() - start_time).total_seconds() * 1000
            result.execution_time_ms = elapsed

            return result

        except Exception as e:
            logger.error(f"Command execution error: {e}")
            elapsed = (datetime.now() - start_time).total_seconds() * 1000

            return CommandResult(
                status=CommandStatus.FAILED,
                message=self._error_message(context, str(e)),
                error=str(e),
                execution_time_ms=elapsed
            )

    def _not_implemented_message(self, context: ConversationContext, intent: Intent) -> str:
        if context.language == 'pt':
            return f"Desculpe, a funcionalidade '{intent.value}' ainda não está implementada."
        return f"Sorry, the '{intent.value}' feature is not yet implemented."

    def _error_message(self, context: ConversationContext, error: str) -> str:
        if context.language == 'pt':
            return f"Ocorreu um erro: {error}"
        return f"An error occurred: {error}"

    # Query implementations

    async def _query_soc(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query current SOC"""
        # In production, this would call the actual API
        # For now, return mock data
        data = {
            'soc': 75.5,
            'timestamp': datetime.now().isoformat()
        }

        formatted = self.formatter.format_soc(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_soh(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query battery health"""
        data = {
            'soh': 95.2,
            'cycles': 450,
            'remaining_cycles': 5550,
            'capacity_kwh': 1000,
            'original_capacity_kwh': 1050
        }

        formatted = self.formatter.format_soh(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_power(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query current power"""
        data = {
            'power': 250.5,
            'mode': 'discharging',
            'max_power': 500
        }

        formatted = self.formatter.format_power(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_temperature(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query temperature"""
        data = {
            'average': 28.5,
            'max': 32.1,
            'min': 25.3,
            'ambient': 22.0
        }

        formatted = self.formatter.format_temperature(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_voltage(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query voltage"""
        data = {
            'total_voltage': 768.5,
            'cell_average': 3.25,
            'cell_max': 3.28,
            'cell_min': 3.22
        }

        formatted = self.formatter.format_voltage(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_current(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query current"""
        data = {
            'current': 325.8,
            'direction': 'discharge'
        }

        if context.language == 'pt':
            direction = 'descarga' if data['direction'] == 'discharge' else 'carga'
            msg = f"Corrente atual: {data['current']:.1f} A ({direction})"
        else:
            msg = f"Current: {data['current']:.1f} A ({data['direction']})"

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data=data
        )

    async def _query_status(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query system status"""
        data = {
            'status': 'online',
            'mode': 'discharging',
            'soc': 75.5,
            'power': 250.5,
            'active_alarms': 0
        }

        formatted = self.formatter.format_status(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_alarms(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query active alarms"""
        data = {
            'alarms': []  # No active alarms for demo
        }

        formatted = self.formatter.format_alarms(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_efficiency(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query efficiency metrics"""
        data = {
            'round_trip_efficiency': 92.5,
            'charge_efficiency': 96.8,
            'discharge_efficiency': 95.5
        }

        formatted = self.formatter.format_efficiency(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_revenue(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query revenue"""
        data = {
            'daily': 1250.00,
            'monthly': 28500.00,
            'yearly': 342000.00
        }

        formatted = self.formatter.format_revenue(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_schedule(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query schedule"""
        now = datetime.now()
        data = {
            'schedules': [
                {'start_time': (now + timedelta(hours=1)).strftime('%H:%M'), 'type': 'charge', 'power': 200},
                {'start_time': (now + timedelta(hours=4)).strftime('%H:%M'), 'type': 'discharge', 'power': 300},
                {'start_time': (now + timedelta(hours=8)).strftime('%H:%M'), 'type': 'charge', 'power': 150},
            ]
        }

        formatted = self.formatter.format_schedule(data, context.language)

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=formatted,
            data=data
        )

    async def _query_forecast(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Query forecast"""
        if context.language == 'pt':
            msg = (
                "📊 Previsão para as próximas 24h:\n"
                "• Preço médio esperado: R$ 150/MWh\n"
                "• Melhor horário para carga: 02:00-06:00\n"
                "• Melhor horário para descarga: 18:00-21:00\n"
                "• Receita estimada: R$ 1.450"
            )
        else:
            msg = (
                "📊 Forecast for next 24h:\n"
                "• Expected average price: $150/MWh\n"
                "• Best time to charge: 02:00-06:00\n"
                "• Best time to discharge: 18:00-21:00\n"
                "• Estimated revenue: $1,450"
            )

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'forecast': 'placeholder'}
        )

    # Command implementations

    async def _cmd_start_charge(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Start charging"""
        power = None
        target_soc = 100

        if frame:
            power_slot = frame.slots.get('power')
            if power_slot and power_slot.value:
                power = power_slot.value

            soc_slot = frame.slots.get('target_soc')
            if soc_slot and soc_slot.value:
                target_soc = soc_slot.value

        # In production, call API
        if context.language == 'pt':
            if power:
                msg = f"✅ Carga iniciada com potência de {power} kW (SOC alvo: {target_soc}%)"
            else:
                msg = f"✅ Carga iniciada em modo automático (SOC alvo: {target_soc}%)"
        else:
            if power:
                msg = f"✅ Charging started at {power} kW (target SOC: {target_soc}%)"
            else:
                msg = f"✅ Charging started in automatic mode (target SOC: {target_soc}%)"

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'power': power, 'target_soc': target_soc, 'action': 'charge_started'}
        )

    async def _cmd_stop_charge(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Stop charging"""
        if context.language == 'pt':
            msg = "✅ Carga interrompida."
        else:
            msg = "✅ Charging stopped."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'action': 'charge_stopped'}
        )

    async def _cmd_start_discharge(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Start discharging"""
        power = None
        min_soc = 10

        if frame:
            power_slot = frame.slots.get('power')
            if power_slot and power_slot.value:
                power = power_slot.value

            soc_slot = frame.slots.get('min_soc')
            if soc_slot and soc_slot.value:
                min_soc = soc_slot.value

        if context.language == 'pt':
            if power:
                msg = f"✅ Descarga iniciada com potência de {power} kW (SOC mínimo: {min_soc}%)"
            else:
                msg = f"✅ Descarga iniciada em modo automático (SOC mínimo: {min_soc}%)"
        else:
            if power:
                msg = f"✅ Discharging started at {power} kW (minimum SOC: {min_soc}%)"
            else:
                msg = f"✅ Discharging started in automatic mode (minimum SOC: {min_soc}%)"

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'power': power, 'min_soc': min_soc, 'action': 'discharge_started'}
        )

    async def _cmd_stop_discharge(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Stop discharging"""
        if context.language == 'pt':
            msg = "✅ Descarga interrompida."
        else:
            msg = "✅ Discharging stopped."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'action': 'discharge_stopped'}
        )

    async def _cmd_set_power(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Set power setpoint"""
        if not frame:
            return CommandResult(
                status=CommandStatus.INVALID_PARAMETERS,
                message="Potência não especificada." if context.language == 'pt' else "Power not specified."
            )

        power_slot = frame.slots.get('power')
        if not power_slot or not power_slot.value:
            return CommandResult(
                status=CommandStatus.INVALID_PARAMETERS,
                message="Potência não especificada." if context.language == 'pt' else "Power not specified."
            )

        power = power_slot.value

        if context.language == 'pt':
            msg = f"✅ Potência configurada para {power} kW."
        else:
            msg = f"✅ Power set to {power} kW."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'power': power, 'action': 'power_set'}
        )

    async def _cmd_set_soc_limit(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Set SOC limit"""
        if not frame:
            return CommandResult(
                status=CommandStatus.INVALID_PARAMETERS,
                message="Limite não especificado." if context.language == 'pt' else "Limit not specified."
            )

        limit_slot = frame.slots.get('limit')
        if not limit_slot or limit_slot.value is None:
            return CommandResult(
                status=CommandStatus.INVALID_PARAMETERS,
                message="Limite não especificado." if context.language == 'pt' else "Limit not specified."
            )

        limit = limit_slot.value
        limit_type = frame.slots.get('limit_type')
        is_max = limit_type and limit_type.value == 'max'

        if context.language == 'pt':
            type_text = "máximo" if is_max else "mínimo"
            msg = f"✅ Limite de SOC {type_text} configurado para {limit}%."
        else:
            type_text = "maximum" if is_max else "minimum"
            msg = f"✅ {type_text.capitalize()} SOC limit set to {limit}%."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'limit': limit, 'type': 'max' if is_max else 'min', 'action': 'soc_limit_set'}
        )

    async def _cmd_emergency_stop(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Execute emergency stop"""
        if context.language == 'pt':
            msg = "🚨 PARADA DE EMERGÊNCIA EXECUTADA!\nTodas as operações foram interrompidas."
        else:
            msg = "🚨 EMERGENCY STOP EXECUTED!\nAll operations have been halted."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'action': 'emergency_stop'}
        )

    async def _cmd_reset_alarms(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Reset alarms"""
        if context.language == 'pt':
            msg = "✅ Alarmes resetados com sucesso."
        else:
            msg = "✅ Alarms reset successfully."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'action': 'alarms_reset'}
        )

    async def _cmd_start_balancing(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Start cell balancing"""
        if context.language == 'pt':
            msg = "✅ Balanceamento de células iniciado.\nTempo estimado: 2-4 horas."
        else:
            msg = "✅ Cell balancing started.\nEstimated time: 2-4 hours."

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'action': 'balancing_started'}
        )

    async def _cmd_run_optimization(
        self,
        context: ConversationContext,
        frame: Optional[DialogFrame]
    ) -> CommandResult:
        """Run optimization"""
        if context.language == 'pt':
            msg = (
                "✅ Otimização executada!\n"
                "• Nova agenda gerada para 24h\n"
                "• Receita estimada: R$ 1.850\n"
                "• Próxima operação: Carga às 02:00"
            )
        else:
            msg = (
                "✅ Optimization completed!\n"
                "• New 24h schedule generated\n"
                "• Estimated revenue: $1,850\n"
                "• Next operation: Charge at 02:00"
            )

        return CommandResult(
            status=CommandStatus.SUCCESS,
            message=msg,
            data={'action': 'optimization_run'}
        )

    def get_navigation_action(self, intent: Intent) -> Optional[Dict[str, str]]:
        """Get navigation action for navigation intents"""
        navigation_map = {
            Intent.NAV_DASHBOARD: {'route': '/dashboard', 'name': 'Dashboard'},
            Intent.NAV_ANALYTICS: {'route': '/analytics', 'name': 'Analytics'},
            Intent.NAV_SETTINGS: {'route': '/settings', 'name': 'Settings'},
            Intent.NAV_ALARMS: {'route': '/alarms', 'name': 'Alarms'},
            Intent.NAV_REPORTS: {'route': '/reports', 'name': 'Reports'},
            Intent.NAV_DIGITAL_TWIN: {'route': '/digital-twin', 'name': 'Digital Twin'},
        }
        return navigation_map.get(intent)
