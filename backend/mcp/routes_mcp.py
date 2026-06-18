from __future__ import annotations
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from backend.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]
TOKEN_PATH = Path(__file__).resolve().parent / "token.json"
router = APIRouter(prefix="/mcp", tags=["mcp"])

_flow_store: dict = {}

def _make_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }
    return Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=GOOGLE_REDIRECT_URI)

@router.get("/auth")
def auth_redirect():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth credentials not configured.")
    flow = _make_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    _flow_store[state] = flow
    return RedirectResponse(authorization_url)

@router.get("/callback")
def auth_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")
    flow = _flow_store.pop(state, None)
    if flow is None:
        flow = _make_flow()
    flow.fetch_token(code=code)
    TOKEN_PATH.write_text(flow.credentials.to_json())
    return {"status": "authenticated", "message": "Google account connected successfully."}

@router.get("/status")
def auth_status():
    if not TOKEN_PATH.exists():
        return {"gmail": False, "calendar": False}
    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        has_token = bool(creds.valid or creds.refresh_token)
        granted = set(creds.scopes or [])
        gmail_ok = has_token and {
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
        }.issubset(granted)
        calendar_ok = has_token and {
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
        }.issubset(granted)
        return {"gmail": gmail_ok, "calendar": calendar_ok}
    except Exception:
        return {"gmail": False, "calendar": False}