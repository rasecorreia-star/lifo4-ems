"""
Audio Analysis Router - Whisper endpoints
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional

from app.services.whisper_service import whisper_service

router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Query(None, description="Language code (pt, en, es)"),
):
    """
    Transcribe audio to text.

    Supports WAV, MP3, M4A, and other common formats.
    """
    if not whisper_service.is_loaded:
        raise HTTPException(status_code=503, detail="Whisper model not loaded")

    # Validate file type
    valid_types = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/m4a", "audio/x-wav"]
    if file.content_type and not any(t in file.content_type for t in valid_types):
        raise HTTPException(
            status_code=400,
            detail="File must be an audio file (WAV, MP3, M4A)"
        )

    try:
        contents = await file.read()
        result = await whisper_service.transcribe(contents, language=language)

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/command")
async def detect_voice_command(
    file: UploadFile = File(...),
):
    """
    Detect voice commands in audio.

    Supported commands:
    - "iniciar carga" / "começar carga" -> start_charge
    - "parar carga" -> stop_charge
    - "parada de emergência" / "emergência" -> emergency_stop
    - "status do sistema" -> system_status
    - "nível de carga" / "quanto de bateria" -> soc_query

    Also detects alert keywords:
    - "perigo", "emergência", "fogo", "incêndio" -> emergency alerts
    """
    if not whisper_service.is_loaded:
        raise HTTPException(status_code=503, detail="Whisper model not loaded")

    try:
        contents = await file.read()
        result = await whisper_service.detect_voice_command(contents)

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_audio_event(
    file: UploadFile = File(...),
):
    """
    Analyze audio for event type (speech, noise, silence).

    Useful for determining if camera talkback is needed.
    """
    if not whisper_service.is_loaded:
        raise HTTPException(status_code=503, detail="Whisper model not loaded")

    try:
        contents = await file.read()
        result = await whisper_service.analyze_audio_event(contents)

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/commands")
async def list_voice_commands():
    """List all supported voice commands."""
    return {
        "commands": [
            {"phrase": k, "action": v}
            for k, v in whisper_service.voice_commands.items()
        ],
        "alert_keywords": [
            {"keyword": k, "type": v}
            for k, v in whisper_service.alert_keywords.items()
        ],
        "language": "pt-BR",
    }


@router.get("/status")
async def audio_status():
    """Get audio service status."""
    return {
        "service": "whisper_audio",
        "loaded": whisper_service.is_loaded,
        "model": whisper_service.model_name,
    }
