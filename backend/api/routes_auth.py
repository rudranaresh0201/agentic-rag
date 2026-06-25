from __future__ import annotations
import os
import requests as http_client
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session
from sqlalchemy.orm import Session

from pydantic import BaseModel

from backend.config import (
    GOOGLE_LOGIN_CLIENT_ID,
    GOOGLE_LOGIN_CLIENT_SECRET,
    GOOGLE_LOGIN_REDIRECT_URI,
    FRONTEND_URL,
)
from backend.db.postgres import get_db
from backend.db.models import User
from backend.auth.jwt_utils import create_jwt, get_current_user

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

router = APIRouter(prefix="/auth", tags=["auth"])
_flow_store: dict = {}


def _make_login_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": GOOGLE_LOGIN_CLIENT_ID,
            "client_secret": GOOGLE_LOGIN_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_LOGIN_REDIRECT_URI],
        }
    }
    return Flow.from_client_config(
        client_config, scopes=SCOPES, redirect_uri=GOOGLE_LOGIN_REDIRECT_URI
    )


@router.get("/google/login")
def google_login():
    if not GOOGLE_LOGIN_CLIENT_ID or not GOOGLE_LOGIN_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google login credentials not configured.")
    flow = _make_login_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    _flow_store[state] = flow
    return RedirectResponse(authorization_url)


@router.get("/google/callback")
def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    flow = _flow_store.pop(state, None)
    if flow is None:
        flow = _make_login_flow()
    flow.fetch_token(code=code)

    resp = http_client.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {flow.credentials.token}"},
        timeout=10,
    )
    if not resp.ok:
        raise HTTPException(status_code=502, detail="Failed to fetch user info from Google.")

    info = resp.json()
    google_id = info.get("sub")
    email = info.get("email")
    name = info.get("name")
    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Google did not return email or ID.")

    # Fetch or create user — check google_id first, fall back to email match
    user = db.query(User).filter(User.google_id == google_id).first()
    if user is None:
        user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, google_id=google_id, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if user.google_id != google_id or user.name != name:
            user.google_id = google_id
            user.name = name
            db.commit()
            db.refresh(user)

    token = create_jwt(str(user.id))
    return RedirectResponse(f"{FRONTEND_URL}?token={token}")


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "github_username": current_user.github_username or "",
        "github_token_set": bool(current_user.github_token),
    }


class GitHubSettingsRequest(BaseModel):
    github_token: str
    github_username: str


@router.post("/settings/github")
def save_github_settings(
    body: GitHubSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    current_user.github_token = body.github_token.strip() or None
    current_user.github_username = body.github_username.strip() or None
    db.commit()
    return {"success": True, "github_username": current_user.github_username or ""}
