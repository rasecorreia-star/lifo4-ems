"""
NLP Router for BESS Virtual Assistant
API endpoints for natural language understanding and command execution.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from ..services.nlp import (
    IntentClassifier,
    Intent,
    IntentCategory,
    EntityExtractor,
    EntityType,
    DialogManager,
    DialogState,
    ConversationContext,
    CommandExecutor,
    CommandResult
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nlp", tags=["Virtual Assistant"])

# Global service instances
_intent_classifier: Optional[IntentClassifier] = None
_entity_extractor: Optional[EntityExtractor] = None
_dialog_manager: Optional[DialogManager] = None
_command_executor: Optional[CommandExecutor] = None


# Request/Response Models

class ChatRequest(BaseModel):
    """Chat request from user"""
    message: str = Field(..., min_length=1, max_length=1000)
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    language: str = "pt"
    context: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    """Chat response to user"""
    response: str
    session_id: str
    intent: Optional[str] = None
    intent_confidence: float = 0.0
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    action: Optional[Dict[str, Any]] = None
    navigation: Optional[Dict[str, str]] = None
    state: str = "completed"
    requires_input: bool = False
    input_prompt: Optional[str] = None


class IntentClassifyRequest(BaseModel):
    """Request to classify intent only"""
    text: str = Field(..., min_length=1, max_length=1000)


class IntentClassifyResponse(BaseModel):
    """Intent classification result"""
    intent: str
    category: str
    confidence: float
    alternatives: List[Dict[str, Any]] = Field(default_factory=list)
    method: str


class EntityExtractRequest(BaseModel):
    """Request to extract entities only"""
    text: str = Field(..., min_length=1, max_length=1000)


class EntityExtractResponse(BaseModel):
    """Entity extraction result"""
    entities: List[Dict[str, Any]]
    has_entities: bool


class SessionInfo(BaseModel):
    """Session information"""
    session_id: str
    user_id: Optional[str]
    created_at: str
    last_activity: str
    state: str
    history_length: int
    selected_bess: Optional[str]
    language: str


# Service initialization

async def get_intent_classifier() -> IntentClassifier:
    """Get or initialize intent classifier"""
    global _intent_classifier
    if _intent_classifier is None:
        _intent_classifier = IntentClassifier()
        await _intent_classifier.load_model()
    return _intent_classifier


async def get_entity_extractor() -> EntityExtractor:
    """Get or initialize entity extractor"""
    global _entity_extractor
    if _entity_extractor is None:
        _entity_extractor = EntityExtractor()
    return _entity_extractor


def get_dialog_manager() -> DialogManager:
    """Get or initialize dialog manager"""
    global _dialog_manager
    if _dialog_manager is None:
        _dialog_manager = DialogManager()
    return _dialog_manager


def get_command_executor() -> CommandExecutor:
    """Get or initialize command executor"""
    global _command_executor
    if _command_executor is None:
        _command_executor = CommandExecutor()
    return _command_executor


# Endpoints

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat message from the user.

    This is the main endpoint for the virtual assistant.
    It handles:
    - Intent classification
    - Entity extraction
    - Dialog management
    - Command execution
    - Response generation
    """
    try:
        # Get services
        classifier = await get_intent_classifier()
        extractor = await get_entity_extractor()
        dialog_mgr = get_dialog_manager()
        executor = get_command_executor()

        # Get or create session
        context = dialog_mgr.get_or_create_session(
            session_id=request.session_id,
            user_id=request.user_id,
            language=request.language
        )

        # Update context with any provided variables
        if request.context:
            context.variables.update(request.context)

        # Classify intent
        intent_result = classifier.classify(request.message)

        # Extract entities
        extraction_result = extractor.extract(request.message)

        # Process dialog turn
        turn = dialog_mgr.process_turn(
            context=context,
            user_input=request.message,
            intent_result=intent_result,
            extraction_result=extraction_result
        )

        # Build response
        response = ChatResponse(
            response=turn.response,
            session_id=context.session_id,
            intent=turn.intent.value if turn.intent else None,
            intent_confidence=turn.intent_confidence,
            entities=[
                {
                    "type": e.type.value,
                    "value": e.value,
                    "raw_text": e.raw_text,
                    "unit": e.unit,
                    "normalized": e.normalized_value
                }
                for e in turn.entities
            ],
            state=turn.state.value
        )

        # Handle executing state
        if turn.state == DialogState.EXECUTING:
            # Execute command/query
            result = await executor.execute(
                context=context,
                intent=turn.intent,
                frame=context.current_frame
            )

            response.response = result.message
            response.action = {
                "status": result.status.value,
                "data": result.data,
                "execution_time_ms": result.execution_time_ms
            }

            # Check for navigation
            if intent_result.category == IntentCategory.NAVIGATION:
                nav = executor.get_navigation_action(turn.intent)
                if nav:
                    response.navigation = nav

            # Complete the turn
            dialog_mgr.complete_turn(context, result.data)
            response.state = "completed"

        # Handle awaiting states
        elif turn.state in [DialogState.AWAITING_CONFIRMATION, DialogState.AWAITING_PARAMETER, DialogState.AWAITING_SELECTION]:
            response.requires_input = True
            response.input_prompt = turn.response
            response.state = turn.state.value

        return response

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/classify", response_model=IntentClassifyResponse)
async def classify_intent(request: IntentClassifyRequest):
    """
    Classify the intent of a text.

    Useful for debugging or direct intent classification.
    """
    try:
        classifier = await get_intent_classifier()
        result = classifier.classify(request.text)

        return IntentClassifyResponse(
            intent=result.intent.value,
            category=result.category.value,
            confidence=result.confidence,
            alternatives=[
                {"intent": i.value, "confidence": c}
                for i, c in result.alternatives
            ],
            method=result.method
        )

    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract", response_model=EntityExtractResponse)
async def extract_entities(request: EntityExtractRequest):
    """
    Extract entities from text.

    Useful for debugging or direct entity extraction.
    """
    try:
        extractor = await get_entity_extractor()
        result = extractor.extract(request.text)

        return EntityExtractResponse(
            entities=[
                {
                    "type": e.type.value,
                    "value": e.value,
                    "raw_text": e.raw_text,
                    "start": e.start,
                    "end": e.end,
                    "unit": e.unit,
                    "normalized_value": e.normalized_value,
                    "confidence": e.confidence
                }
                for e in result.entities
            ],
            has_entities=result.has_entities
        )

    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    """
    Get information about a chat session.
    """
    dialog_mgr = get_dialog_manager()

    if session_id not in dialog_mgr.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = dialog_mgr.sessions[session_id]

    return SessionInfo(
        session_id=session.session_id,
        user_id=session.user_id,
        created_at=session.created_at.isoformat(),
        last_activity=session.last_activity.isoformat(),
        state=session.current_state.value,
        history_length=len(session.history),
        selected_bess=session.selected_bess,
        language=session.language
    )


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a chat session.
    """
    dialog_mgr = get_dialog_manager()

    if session_id not in dialog_mgr.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    del dialog_mgr.sessions[session_id]

    return {"success": True, "message": f"Session {session_id} deleted"}


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str, limit: int = 10):
    """
    Get chat history for a session.
    """
    dialog_mgr = get_dialog_manager()

    if session_id not in dialog_mgr.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = dialog_mgr.sessions[session_id]

    history = list(session.history)[-limit:]

    return {
        "session_id": session_id,
        "history": [
            {
                "id": turn.id,
                "timestamp": turn.timestamp.isoformat(),
                "user_input": turn.user_input,
                "intent": turn.intent.value if turn.intent else None,
                "response": turn.response,
                "state": turn.state.value
            }
            for turn in history
        ],
        "total_turns": len(session.history)
    }


@router.get("/intents")
async def list_intents():
    """
    List all supported intents.
    """
    classifier = await get_intent_classifier()
    return {"intents": classifier.get_supported_intents()}


@router.get("/entities")
async def list_entity_types():
    """
    List all supported entity types.
    """
    return {
        "entity_types": [
            {
                "type": e.value,
                "description": e.name.replace("_", " ").title()
            }
            for e in EntityType
        ]
    }


@router.post("/cleanup")
async def cleanup_sessions():
    """
    Clean up expired sessions.
    """
    dialog_mgr = get_dialog_manager()

    before = len(dialog_mgr.sessions)
    dialog_mgr.cleanup_expired_sessions()
    after = len(dialog_mgr.sessions)

    return {
        "success": True,
        "sessions_before": before,
        "sessions_after": after,
        "removed": before - after
    }


@router.get("/health")
async def health_check():
    """
    Health check for NLP service.
    """
    classifier = await get_intent_classifier()

    return {
        "status": "ok",
        "services": {
            "intent_classifier": {
                "loaded": classifier.is_loaded,
                "model": classifier.model_name
            },
            "entity_extractor": "ready",
            "dialog_manager": "ready",
            "command_executor": "ready"
        },
        "active_sessions": len(get_dialog_manager().sessions)
    }


# Example usage endpoint
@router.get("/examples")
async def get_examples():
    """
    Get example commands and queries.
    """
    return {
        "examples": {
            "queries": [
                {"pt": "Qual o SOC atual?", "en": "What's the current SOC?"},
                {"pt": "Como está a temperatura?", "en": "What's the temperature?"},
                {"pt": "Tem algum alarme ativo?", "en": "Any active alarms?"},
                {"pt": "Qual o status do sistema?", "en": "What's the system status?"},
                {"pt": "Qual a eficiência da bateria?", "en": "What's the battery efficiency?"},
            ],
            "commands": [
                {"pt": "Iniciar carga", "en": "Start charging"},
                {"pt": "Parar descarga", "en": "Stop discharging"},
                {"pt": "Definir potência para 200 kW", "en": "Set power to 200 kW"},
                {"pt": "Parada de emergência", "en": "Emergency stop"},
                {"pt": "Resetar alarmes", "en": "Reset alarms"},
            ],
            "navigation": [
                {"pt": "Ir para o dashboard", "en": "Go to dashboard"},
                {"pt": "Mostrar relatórios", "en": "Show reports"},
                {"pt": "Abrir digital twin", "en": "Open digital twin"},
            ]
        }
    }
