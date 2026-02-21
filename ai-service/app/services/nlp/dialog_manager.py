"""
Dialog Manager for BESS Virtual Assistant
Manages conversation state, context, and multi-turn interactions.
"""

import uuid
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import logging
from collections import deque

from .intent_classifier import Intent, IntentCategory, IntentResult
from .entity_extractor import Entity, EntityType, ExtractionResult

logger = logging.getLogger(__name__)


class DialogState(Enum):
    """States of the dialog"""
    IDLE = "idle"                     # Waiting for user input
    PROCESSING = "processing"         # Processing request
    AWAITING_CONFIRMATION = "awaiting_confirmation"  # Waiting for yes/no
    AWAITING_PARAMETER = "awaiting_parameter"  # Waiting for specific info
    AWAITING_SELECTION = "awaiting_selection"  # Waiting for choice
    EXECUTING = "executing"           # Executing command
    COMPLETED = "completed"           # Turn completed
    ERROR = "error"                   # Error state


class SlotStatus(Enum):
    """Status of a dialog slot"""
    EMPTY = "empty"
    FILLED = "filled"
    INVALID = "invalid"
    CONFIRMED = "confirmed"


@dataclass
class DialogSlot:
    """A slot in a dialog frame"""
    name: str
    entity_type: EntityType
    required: bool = True
    value: Any = None
    status: SlotStatus = SlotStatus.EMPTY
    prompt: str = ""
    validator: Optional[Callable] = None
    default: Any = None


@dataclass
class DialogFrame:
    """A dialog frame for a specific intent"""
    intent: Intent
    slots: Dict[str, DialogSlot] = field(default_factory=dict)
    confirmation_required: bool = False
    confirmed: bool = False

    def is_complete(self) -> bool:
        """Check if all required slots are filled"""
        for slot in self.slots.values():
            if slot.required and slot.status not in [SlotStatus.FILLED, SlotStatus.CONFIRMED]:
                return False
        return True

    def get_missing_slots(self) -> List[DialogSlot]:
        """Get list of unfilled required slots"""
        return [
            slot for slot in self.slots.values()
            if slot.required and slot.status not in [SlotStatus.FILLED, SlotStatus.CONFIRMED]
        ]


@dataclass
class DialogTurn:
    """A single turn in the conversation"""
    id: str
    timestamp: datetime
    user_input: str
    intent: Optional[Intent] = None
    intent_confidence: float = 0.0
    entities: List[Entity] = field(default_factory=list)
    response: str = ""
    state: DialogState = DialogState.IDLE
    action_taken: Optional[str] = None
    action_result: Optional[Dict[str, Any]] = None


@dataclass
class ConversationContext:
    """Context for a conversation session"""
    session_id: str
    user_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    current_state: DialogState = DialogState.IDLE
    current_frame: Optional[DialogFrame] = None
    history: deque = field(default_factory=lambda: deque(maxlen=20))
    variables: Dict[str, Any] = field(default_factory=dict)
    selected_bess: Optional[str] = None
    language: str = "pt"  # Default Portuguese

    def add_turn(self, turn: DialogTurn):
        """Add a turn to history"""
        self.history.append(turn)
        self.last_activity = datetime.now()

    def get_last_intent(self) -> Optional[Intent]:
        """Get the last recognized intent"""
        if self.history:
            return self.history[-1].intent
        return None

    def get_entities_from_history(
        self,
        entity_type: EntityType,
        limit: int = 5
    ) -> List[Entity]:
        """Get entities of a type from recent history"""
        entities = []
        for turn in reversed(self.history):
            for entity in turn.entities:
                if entity.type == entity_type:
                    entities.append(entity)
                    if len(entities) >= limit:
                        return entities
        return entities

    def is_expired(self, timeout_minutes: int = 30) -> bool:
        """Check if session has expired"""
        return (datetime.now() - self.last_activity).total_seconds() > timeout_minutes * 60


# Dialog frame templates for different intents
DIALOG_FRAMES = {
    Intent.CMD_SET_POWER: DialogFrame(
        intent=Intent.CMD_SET_POWER,
        slots={
            'power': DialogSlot(
                name='power',
                entity_type=EntityType.POWER,
                required=True,
                prompt="Qual potência você deseja configurar? (ex: 100 kW)"
            ),
            'bess_id': DialogSlot(
                name='bess_id',
                entity_type=EntityType.BESS_ID,
                required=False,
                prompt="Para qual BESS?"
            )
        },
        confirmation_required=True
    ),
    Intent.CMD_SET_SOC_LIMIT: DialogFrame(
        intent=Intent.CMD_SET_SOC_LIMIT,
        slots={
            'limit': DialogSlot(
                name='limit',
                entity_type=EntityType.PERCENTAGE,
                required=True,
                prompt="Qual o limite de SOC desejado? (ex: 80%)"
            ),
            'limit_type': DialogSlot(
                name='limit_type',
                entity_type=EntityType.CUSTOM,
                required=True,
                prompt="É limite mínimo ou máximo?",
                default='max'
            )
        },
        confirmation_required=True
    ),
    Intent.CMD_START_CHARGE: DialogFrame(
        intent=Intent.CMD_START_CHARGE,
        slots={
            'power': DialogSlot(
                name='power',
                entity_type=EntityType.POWER,
                required=False,
                prompt="Com qual potência? (ou deixe em branco para automático)"
            ),
            'target_soc': DialogSlot(
                name='target_soc',
                entity_type=EntityType.PERCENTAGE,
                required=False,
                prompt="Até qual SOC? (ou deixe em branco para 100%)",
                default=100
            )
        },
        confirmation_required=False
    ),
    Intent.CMD_START_DISCHARGE: DialogFrame(
        intent=Intent.CMD_START_DISCHARGE,
        slots={
            'power': DialogSlot(
                name='power',
                entity_type=EntityType.POWER,
                required=False,
                prompt="Com qual potência?"
            ),
            'min_soc': DialogSlot(
                name='min_soc',
                entity_type=EntityType.PERCENTAGE,
                required=False,
                prompt="Até qual SOC mínimo?",
                default=10
            )
        },
        confirmation_required=False
    ),
    Intent.CMD_EMERGENCY_STOP: DialogFrame(
        intent=Intent.CMD_EMERGENCY_STOP,
        slots={},
        confirmation_required=True
    ),
    Intent.REPORT_CUSTOM: DialogFrame(
        intent=Intent.REPORT_CUSTOM,
        slots={
            'start_date': DialogSlot(
                name='start_date',
                entity_type=EntityType.DATE,
                required=True,
                prompt="Data inicial do relatório?"
            ),
            'end_date': DialogSlot(
                name='end_date',
                entity_type=EntityType.DATE,
                required=True,
                prompt="Data final do relatório?"
            )
        },
        confirmation_required=False
    ),
    Intent.CONFIG_THRESHOLDS: DialogFrame(
        intent=Intent.CONFIG_THRESHOLDS,
        slots={
            'parameter': DialogSlot(
                name='parameter',
                entity_type=EntityType.CUSTOM,
                required=True,
                prompt="Qual parâmetro deseja configurar? (temperatura, voltagem, SOC...)"
            ),
            'value': DialogSlot(
                name='value',
                entity_type=EntityType.CUSTOM,
                required=True,
                prompt="Qual o novo valor?"
            )
        },
        confirmation_required=True
    )
}

# Response templates
RESPONSE_TEMPLATES = {
    'pt': {
        Intent.GREETING: [
            "Olá! Como posso ajudar com o sistema BESS hoje?",
            "Oi! Estou aqui para ajudar. O que você precisa?",
            "Olá! Pronto para ajudar com a gestão das baterias."
        ],
        Intent.FAREWELL: [
            "Até logo! Qualquer coisa, é só chamar.",
            "Tchau! Bom trabalho!",
            "Até mais! O sistema continua monitorado."
        ],
        Intent.THANKS: [
            "De nada! Precisando, é só chamar.",
            "Por nada! Estou aqui para ajudar.",
            "Disponha! Fico feliz em ajudar."
        ],
        Intent.HELP: [
            "Posso ajudar com:\n"
            "• Consultas: SOC, SOH, potência, temperatura, status\n"
            "• Comandos: iniciar/parar carga, configurar potência\n"
            "• Relatórios: diário, semanal, mensal\n"
            "• Navegação: ir para dashboard, análises, configurações\n\n"
            "O que você gostaria de fazer?"
        ],
        Intent.UNKNOWN: [
            "Desculpe, não entendi. Pode reformular?",
            "Não compreendi. Você pode dizer de outra forma?",
            "Não consegui entender. Tente ser mais específico."
        ],
        'confirmation_yes': "Confirmado! Executando...",
        'confirmation_no': "Ok, operação cancelada.",
        'confirmation_prompt': "Deseja confirmar esta operação?",
        'slot_filled': "Entendi: {slot} = {value}",
        'command_success': "Comando executado com sucesso!",
        'command_error': "Erro ao executar comando: {error}",
        'query_result': "{result}",
    },
    'en': {
        Intent.GREETING: [
            "Hello! How can I help with the BESS system today?",
            "Hi! I'm here to help. What do you need?",
            "Hello! Ready to help with battery management."
        ],
        Intent.FAREWELL: [
            "Goodbye! Let me know if you need anything.",
            "Bye! Have a good day!",
            "See you! The system remains monitored."
        ],
        Intent.THANKS: [
            "You're welcome! Just let me know if you need help.",
            "No problem! Happy to help.",
            "Anytime! I'm here to assist."
        ],
        Intent.HELP: [
            "I can help with:\n"
            "• Queries: SOC, SOH, power, temperature, status\n"
            "• Commands: start/stop charge, set power\n"
            "• Reports: daily, weekly, monthly\n"
            "• Navigation: go to dashboard, analytics, settings\n\n"
            "What would you like to do?"
        ],
        Intent.UNKNOWN: [
            "Sorry, I didn't understand. Can you rephrase?",
            "I didn't get that. Could you say it differently?",
            "I couldn't understand. Please be more specific."
        ],
        'confirmation_yes': "Confirmed! Executing...",
        'confirmation_no': "OK, operation cancelled.",
        'confirmation_prompt': "Do you want to confirm this operation?",
        'slot_filled': "Got it: {slot} = {value}",
        'command_success': "Command executed successfully!",
        'command_error': "Error executing command: {error}",
        'query_result': "{result}",
    }
}


class DialogManager:
    """
    Manages dialog flow and conversation state.

    Features:
    - Multi-turn conversation handling
    - Slot filling for commands
    - Confirmation handling
    - Context management
    - Response generation
    """

    def __init__(self):
        self.sessions: Dict[str, ConversationContext] = {}
        self.session_timeout_minutes = 30

    def get_or_create_session(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        language: str = "pt"
    ) -> ConversationContext:
        """Get existing session or create new one"""
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            if not session.is_expired(self.session_timeout_minutes):
                return session

        # Create new session
        new_session_id = session_id or str(uuid.uuid4())
        session = ConversationContext(
            session_id=new_session_id,
            user_id=user_id,
            language=language
        )
        self.sessions[new_session_id] = session
        return session

    def process_turn(
        self,
        context: ConversationContext,
        user_input: str,
        intent_result: IntentResult,
        extraction_result: ExtractionResult
    ) -> DialogTurn:
        """
        Process a single conversation turn.

        Args:
            context: Conversation context
            user_input: User's input text
            intent_result: Result from intent classifier
            extraction_result: Result from entity extractor

        Returns:
            DialogTurn with response
        """
        turn = DialogTurn(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            user_input=user_input,
            intent=intent_result.intent,
            intent_confidence=intent_result.confidence,
            entities=extraction_result.entities
        )

        # Handle based on current state
        if context.current_state == DialogState.AWAITING_CONFIRMATION:
            turn = self._handle_confirmation(context, turn)

        elif context.current_state == DialogState.AWAITING_PARAMETER:
            turn = self._handle_parameter(context, turn)

        elif context.current_state == DialogState.AWAITING_SELECTION:
            turn = self._handle_selection(context, turn)

        else:
            # New request
            turn = self._handle_new_request(context, turn, intent_result, extraction_result)

        # Add turn to history
        context.add_turn(turn)

        return turn

    def _handle_new_request(
        self,
        context: ConversationContext,
        turn: DialogTurn,
        intent_result: IntentResult,
        extraction_result: ExtractionResult
    ) -> DialogTurn:
        """Handle a new user request"""
        intent = intent_result.intent
        category = intent_result.category

        # Handle simple intents (no slots)
        if category in [IntentCategory.GREETING, IntentCategory.HELP]:
            turn.response = self._get_response(context, intent)
            turn.state = DialogState.COMPLETED
            context.current_state = DialogState.IDLE
            return turn

        # Handle query intents
        if category == IntentCategory.QUERY:
            turn.state = DialogState.EXECUTING
            context.current_state = DialogState.EXECUTING
            # Actual execution will be done by command_executor
            return turn

        # Handle command intents
        if category == IntentCategory.COMMAND:
            return self._setup_command_dialog(context, turn, intent, extraction_result)

        # Handle navigation intents
        if category == IntentCategory.NAVIGATION:
            turn.state = DialogState.EXECUTING
            context.current_state = DialogState.EXECUTING
            return turn

        # Handle report intents
        if category == IntentCategory.REPORT:
            return self._setup_report_dialog(context, turn, intent, extraction_result)

        # Unknown intent
        turn.response = self._get_response(context, Intent.UNKNOWN)
        turn.state = DialogState.COMPLETED
        context.current_state = DialogState.IDLE
        return turn

    def _setup_command_dialog(
        self,
        context: ConversationContext,
        turn: DialogTurn,
        intent: Intent,
        extraction_result: ExtractionResult
    ) -> DialogTurn:
        """Setup dialog frame for command execution"""
        # Get or create dialog frame
        if intent in DIALOG_FRAMES:
            frame = self._copy_frame(DIALOG_FRAMES[intent])
        else:
            # Simple command without slots
            frame = DialogFrame(intent=intent)

        # Fill slots from extracted entities
        for entity in extraction_result.entities:
            for slot in frame.slots.values():
                if slot.entity_type == entity.type and slot.status == SlotStatus.EMPTY:
                    slot.value = entity.normalized_value or entity.value
                    slot.status = SlotStatus.FILLED
                    break

        context.current_frame = frame

        # Check if frame is complete
        if frame.is_complete():
            if frame.confirmation_required and not frame.confirmed:
                turn.response = self._generate_confirmation_prompt(context, frame)
                turn.state = DialogState.AWAITING_CONFIRMATION
                context.current_state = DialogState.AWAITING_CONFIRMATION
            else:
                turn.state = DialogState.EXECUTING
                context.current_state = DialogState.EXECUTING
        else:
            # Ask for missing slots
            missing = frame.get_missing_slots()
            if missing:
                turn.response = missing[0].prompt
                turn.state = DialogState.AWAITING_PARAMETER
                context.current_state = DialogState.AWAITING_PARAMETER

        return turn

    def _setup_report_dialog(
        self,
        context: ConversationContext,
        turn: DialogTurn,
        intent: Intent,
        extraction_result: ExtractionResult
    ) -> DialogTurn:
        """Setup dialog for report generation"""
        if intent == Intent.REPORT_CUSTOM:
            return self._setup_command_dialog(context, turn, intent, extraction_result)

        # Standard reports don't need parameters
        turn.state = DialogState.EXECUTING
        context.current_state = DialogState.EXECUTING
        return turn

    def _handle_confirmation(
        self,
        context: ConversationContext,
        turn: DialogTurn
    ) -> DialogTurn:
        """Handle confirmation response"""
        user_input = turn.user_input.lower().strip()

        # Check for yes/no
        yes_patterns = ['sim', 'yes', 's', 'y', 'ok', 'confirmo', 'pode', 'vai', 'manda']
        no_patterns = ['nao', 'no', 'n', 'cancela', 'para', 'desiste']

        if any(p in user_input for p in yes_patterns):
            if context.current_frame:
                context.current_frame.confirmed = True
            turn.response = self._get_template(context, 'confirmation_yes')
            turn.state = DialogState.EXECUTING
            context.current_state = DialogState.EXECUTING

        elif any(p in user_input for p in no_patterns):
            context.current_frame = None
            turn.response = self._get_template(context, 'confirmation_no')
            turn.state = DialogState.COMPLETED
            context.current_state = DialogState.IDLE

        else:
            # Didn't understand - ask again
            turn.response = self._get_template(context, 'confirmation_prompt')
            turn.state = DialogState.AWAITING_CONFIRMATION

        return turn

    def _handle_parameter(
        self,
        context: ConversationContext,
        turn: DialogTurn
    ) -> DialogTurn:
        """Handle parameter input"""
        if not context.current_frame:
            turn.state = DialogState.ERROR
            context.current_state = DialogState.IDLE
            return turn

        # Try to fill the first empty required slot
        missing_slots = context.current_frame.get_missing_slots()
        if not missing_slots:
            turn.state = DialogState.EXECUTING
            context.current_state = DialogState.EXECUTING
            return turn

        target_slot = missing_slots[0]

        # Try to extract value from input
        value_found = False
        for entity in turn.entities:
            if entity.type == target_slot.entity_type:
                target_slot.value = entity.normalized_value or entity.value
                target_slot.status = SlotStatus.FILLED
                value_found = True
                break

        if not value_found:
            # Try to parse raw input as the value
            try:
                if target_slot.entity_type == EntityType.PERCENTAGE:
                    # Try to extract percentage
                    import re
                    match = re.search(r'(\d+(?:[.,]\d+)?)', turn.user_input)
                    if match:
                        target_slot.value = float(match.group(1).replace(',', '.'))
                        target_slot.status = SlotStatus.FILLED
                        value_found = True
                elif target_slot.entity_type == EntityType.POWER:
                    import re
                    match = re.search(r'(\d+(?:[.,]\d+)?)', turn.user_input)
                    if match:
                        target_slot.value = float(match.group(1).replace(',', '.'))
                        target_slot.status = SlotStatus.FILLED
                        value_found = True
                else:
                    # Store raw value for custom types
                    target_slot.value = turn.user_input
                    target_slot.status = SlotStatus.FILLED
                    value_found = True
            except Exception:
                pass

        if value_found:
            turn.response = self._get_template(
                context, 'slot_filled'
            ).format(slot=target_slot.name, value=target_slot.value)

            # Check if more slots needed
            if context.current_frame.is_complete():
                if context.current_frame.confirmation_required and not context.current_frame.confirmed:
                    turn.response += "\n" + self._generate_confirmation_prompt(context, context.current_frame)
                    turn.state = DialogState.AWAITING_CONFIRMATION
                    context.current_state = DialogState.AWAITING_CONFIRMATION
                else:
                    turn.state = DialogState.EXECUTING
                    context.current_state = DialogState.EXECUTING
            else:
                # Ask for next slot
                next_missing = context.current_frame.get_missing_slots()
                if next_missing:
                    turn.response += "\n" + next_missing[0].prompt
                    turn.state = DialogState.AWAITING_PARAMETER
        else:
            # Couldn't parse value
            turn.response = f"Não entendi o valor. {target_slot.prompt}"
            turn.state = DialogState.AWAITING_PARAMETER

        return turn

    def _handle_selection(
        self,
        context: ConversationContext,
        turn: DialogTurn
    ) -> DialogTurn:
        """Handle selection from options"""
        # Implementation for multiple choice scenarios
        turn.state = DialogState.COMPLETED
        context.current_state = DialogState.IDLE
        return turn

    def _generate_confirmation_prompt(
        self,
        context: ConversationContext,
        frame: DialogFrame
    ) -> str:
        """Generate confirmation prompt with summary"""
        lang = context.language

        if lang == 'pt':
            prompt = "Confirma a operação:\n"
            if frame.intent == Intent.CMD_EMERGENCY_STOP:
                prompt = "⚠️ ATENÇÃO: Deseja executar PARADA DE EMERGÊNCIA?\n"
            elif frame.intent == Intent.CMD_SET_POWER:
                power = frame.slots.get('power')
                if power and power.value:
                    prompt = f"Confirma: Definir potência para {power.value} kW?\n"
            elif frame.intent == Intent.CMD_SET_SOC_LIMIT:
                limit = frame.slots.get('limit')
                if limit and limit.value:
                    prompt = f"Confirma: Definir limite SOC para {limit.value}%?\n"
            prompt += "(Sim/Não)"
        else:
            prompt = "Confirm operation:\n"
            if frame.intent == Intent.CMD_EMERGENCY_STOP:
                prompt = "⚠️ WARNING: Execute EMERGENCY STOP?\n"
            prompt += "(Yes/No)"

        return prompt

    def _copy_frame(self, frame: DialogFrame) -> DialogFrame:
        """Create a copy of a dialog frame"""
        new_frame = DialogFrame(
            intent=frame.intent,
            confirmation_required=frame.confirmation_required
        )

        for name, slot in frame.slots.items():
            new_frame.slots[name] = DialogSlot(
                name=slot.name,
                entity_type=slot.entity_type,
                required=slot.required,
                prompt=slot.prompt,
                validator=slot.validator,
                default=slot.default
            )

        return new_frame

    def _get_response(self, context: ConversationContext, intent: Intent) -> str:
        """Get response template for intent"""
        lang = context.language
        templates = RESPONSE_TEMPLATES.get(lang, RESPONSE_TEMPLATES['en'])

        if intent in templates:
            responses = templates[intent]
            if isinstance(responses, list):
                import random
                return random.choice(responses)
            return responses

        return templates.get(Intent.UNKNOWN, ["Unknown intent"])[0]

    def _get_template(self, context: ConversationContext, key: str) -> str:
        """Get response template by key"""
        lang = context.language
        templates = RESPONSE_TEMPLATES.get(lang, RESPONSE_TEMPLATES['en'])
        return templates.get(key, key)

    def set_response(self, context: ConversationContext, response: str):
        """Set response for current turn"""
        if context.history:
            context.history[-1].response = response

    def complete_turn(self, context: ConversationContext, result: Optional[Dict[str, Any]] = None):
        """Mark current turn as completed"""
        if context.history:
            context.history[-1].state = DialogState.COMPLETED
            if result:
                context.history[-1].action_result = result

        context.current_state = DialogState.IDLE
        context.current_frame = None

    def get_current_frame(self, context: ConversationContext) -> Optional[DialogFrame]:
        """Get current dialog frame"""
        return context.current_frame

    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        expired = [
            sid for sid, session in self.sessions.items()
            if session.is_expired(self.session_timeout_minutes)
        ]

        for sid in expired:
            del self.sessions[sid]

        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")
