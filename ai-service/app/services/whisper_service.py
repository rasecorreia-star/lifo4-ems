"""
Whisper Audio Analysis Service
Speech-to-text, voice command detection, audio event analysis
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from pathlib import Path
import numpy as np
import io
import tempfile
import os

from app.config import settings

logger = logging.getLogger(__name__)


class WhisperService:
    """OpenAI Whisper audio transcription service."""

    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.model_name = settings.whisper_model

        # Voice commands for EMS control
        self.voice_commands = {
            "iniciar carga": "start_charge",
            "começar carga": "start_charge",
            "carregar bateria": "start_charge",
            "parar carga": "stop_charge",
            "interromper carga": "stop_charge",
            "iniciar descarga": "start_discharge",
            "começar descarga": "start_discharge",
            "parar descarga": "stop_discharge",
            "parada de emergência": "emergency_stop",
            "emergência": "emergency_stop",
            "status do sistema": "system_status",
            "qual o estado": "system_status",
            "nível de carga": "soc_query",
            "quanto de bateria": "soc_query",
        }

        # Alert keywords
        self.alert_keywords = {
            "perigo": "danger",
            "emergência": "emergency",
            "fogo": "fire",
            "incêndio": "fire",
            "vazamento": "leak",
            "fumaça": "smoke",
            "ajuda": "help",
            "socorro": "help",
        }

    async def load_model(self):
        """Load Whisper model."""
        try:
            import whisper

            logger.info(f"Loading Whisper model: {self.model_name}")

            # Load model in thread pool
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(
                None,
                lambda: whisper.load_model(self.model_name)
            )

            self.is_loaded = True
            logger.info(f"Whisper model '{self.model_name}' loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.is_loaded = False

    async def transcribe(
        self,
        audio_data: bytes,
        language: str = None,
    ) -> Dict[str, Any]:
        """
        Transcribe audio to text.

        Args:
            audio_data: Audio file bytes (wav, mp3, etc.)
            language: Language code (default: Portuguese)

        Returns:
            Transcription result with text and segments
        """
        if not self.is_loaded:
            raise RuntimeError("Whisper model not loaded")

        lang = language or settings.whisper_language

        # Write audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name

        try:
            # Transcribe in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.model.transcribe(
                    temp_path,
                    language=lang,
                    task="transcribe",
                )
            )

            # Extract segments
            segments = [
                {
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"].strip(),
                }
                for seg in result.get("segments", [])
            ]

            return {
                "text": result["text"].strip(),
                "language": result.get("language", lang),
                "segments": segments,
                "duration": segments[-1]["end"] if segments else 0,
            }

        finally:
            # Clean up temp file
            os.unlink(temp_path)

    async def detect_voice_command(
        self,
        audio_data: bytes,
    ) -> Dict[str, Any]:
        """
        Detect voice commands in audio.

        Args:
            audio_data: Audio file bytes

        Returns:
            Detected command and confidence
        """
        result = await self.transcribe(audio_data)
        text = result["text"].lower()

        detected_commands = []

        # Check for matching commands
        for phrase, command in self.voice_commands.items():
            if phrase in text:
                detected_commands.append({
                    "command": command,
                    "trigger_phrase": phrase,
                    "confidence": 0.9 if phrase == text.strip() else 0.7,
                })

        # Check for alert keywords
        detected_alerts = []
        for keyword, alert_type in self.alert_keywords.items():
            if keyword in text:
                detected_alerts.append({
                    "type": alert_type,
                    "keyword": keyword,
                })

        return {
            "text": result["text"],
            "commands": detected_commands,
            "alerts": detected_alerts,
            "has_command": len(detected_commands) > 0,
            "has_alert": len(detected_alerts) > 0,
            "primary_command": detected_commands[0] if detected_commands else None,
        }

    async def analyze_audio_event(
        self,
        audio_data: bytes,
    ) -> Dict[str, Any]:
        """
        Analyze audio for events (speech, noise, silence).

        Args:
            audio_data: Audio file bytes

        Returns:
            Audio event analysis
        """
        import librosa
        import soundfile as sf

        # Load audio
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name

        try:
            # Load with librosa
            y, sr = librosa.load(temp_path, sr=16000)

            # Calculate audio features
            rms = librosa.feature.rms(y=y)[0]
            avg_rms = float(np.mean(rms))
            max_rms = float(np.max(rms))

            # Detect speech vs noise
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            avg_zcr = float(np.mean(zcr))

            # Duration
            duration = len(y) / sr

            # Classify audio type
            audio_type = "silence"
            if avg_rms > 0.01:
                if avg_zcr > 0.1:
                    audio_type = "speech"
                else:
                    audio_type = "noise"

            # Try transcription if it sounds like speech
            transcription = None
            if audio_type == "speech":
                try:
                    result = await self.transcribe(audio_data)
                    transcription = result["text"]
                except:
                    pass

            return {
                "duration": round(duration, 2),
                "audio_type": audio_type,
                "volume": {
                    "average": round(avg_rms, 4),
                    "peak": round(max_rms, 4),
                },
                "has_speech": audio_type == "speech",
                "transcription": transcription,
            }

        finally:
            os.unlink(temp_path)

    async def generate_tts_response(
        self,
        text: str,
        voice: str = "female",
    ) -> bytes:
        """
        Generate text-to-speech audio response.

        Args:
            text: Text to convert to speech
            voice: Voice type

        Returns:
            Audio data bytes (WAV format)

        Note: This is a placeholder. Implement with a TTS service like:
        - Google Cloud TTS
        - Amazon Polly
        - Azure Speech
        - Coqui TTS (local)
        """
        # Placeholder - would integrate with TTS service
        raise NotImplementedError("TTS not implemented - integrate with TTS service")


# Singleton instance
whisper_service = WhisperService()
