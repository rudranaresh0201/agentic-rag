from __future__ import annotations

import os

import requests as http_requests
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.config import GROQ_WHISPER_MODEL

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)) -> dict:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    audio_bytes = await file.read()
    filename = file.filename or "audio.webm"
    content_type = file.content_type or "audio/webm"

    try:
        resp = http_requests.post(
            _TRANSCRIBE_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            files={"file": (filename, audio_bytes, content_type)},
            data={"model": GROQ_WHISPER_MODEL, "response_format": "json"},
            timeout=30,
        )
        resp.raise_for_status()
    except http_requests.HTTPError as exc:
        detail = ""
        try:
            detail = exc.response.json().get("error", {}).get("message", str(exc))
        except Exception:
            detail = str(exc)
        raise HTTPException(status_code=502, detail=f"Whisper API error: {detail}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"text": resp.json().get("text", "").strip()}


class SpeakRequest(BaseModel):
    text: str


@router.post("/speak")
def speak_text(body: SpeakRequest) -> dict:
    # Groq does not yet expose a TTS endpoint.
    # Return fallback=true so the client uses browser speechSynthesis.
    return {"audio_base64": "", "fallback": True}
