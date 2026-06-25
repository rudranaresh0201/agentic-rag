from __future__ import annotations

import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session

from urllib.parse import urlparse, urlencode, quote
from backend.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL
from backend.config import get_allowed_origins
from backend.auth.jwt_utils import get_current_user
from backend.db.models import User, UserGoogleToken, OAuthState
from backend.db.postgres import get_db

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]

router = APIRouter(prefix="/mcp", tags=["mcp"])


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


def _safe_return_to(return_to: str | None) -> str:
    """Validate return_to is from an allowed origin; fall back to FRONTEND_URL."""
    if not return_to:
        return FRONTEND_URL
    try:
        parsed = urlparse(return_to)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        allowed = get_allowed_origins() + [FRONTEND_URL]
        if origin in allowed:
            return return_to
    except Exception:
        pass
    return FRONTEND_URL


@router.get("/auth")
def auth_redirect(
    token: str | None = None,
    return_to: str | None = None,
    db: Session = Depends(get_db),
):
    safe_return = _safe_return_to(return_to)

    if not token:
        return RedirectResponse(f"{safe_return}?google_error={quote('Not authenticated — please log in again.')}")
    try:
        from backend.auth.jwt_utils import decode_jwt
        payload = decode_jwt(token)
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
    except Exception:
        return RedirectResponse(f"{safe_return}?google_error={quote('Session expired — please log in again.')}")
    if user is None:
        return RedirectResponse(f"{safe_return}?google_error={quote('User not found — please log in again.')}")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(f"{safe_return}?google_error={quote('Google OAuth not configured on this server.')}")

    flow = _make_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    # Persist state + code_verifier + return_to in DB
    db.merge(OAuthState(
        state=state,
        user_id=str(user.id),
        code_verifier=flow.code_verifier,
        return_to=safe_return,
    ))
    db.commit()

    return RedirectResponse(authorization_url)


@router.get("/callback")
def auth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    print(f"[mcp/callback] hit — code={'set' if code else 'MISSING'}, state={'set' if state else 'MISSING'}, error={error}")

    # Look up return_to early so even error redirects go back to the right URL
    state_row = db.query(OAuthState).filter(OAuthState.state == state).first() if state else None
    return_to = (state_row.return_to if state_row and state_row.return_to else None) or FRONTEND_URL

    if error:
        msg = "Access denied." if error == "access_denied" else f"Google OAuth error: {error}"
        if error == "access_denied":
            msg = "Google blocked this connection. If this app is in test mode, ask the developer to add your email as a test user in Google Cloud Console."
        print(f"[mcp/callback] OAuth error from Google: {error}")
        return RedirectResponse(f"{return_to}?google_error={quote(msg)}")

    if not code or not state:
        return RedirectResponse(f"{return_to}?google_error={quote('Missing authorization code. Please try again.')}")

    print(f"[mcp/callback] OAuthState lookup: {'FOUND user_id=' + state_row.user_id if state_row else 'NOT FOUND'}")
    if state_row is None:
        return RedirectResponse(f"{return_to}?google_error={quote('OAuth session expired. Please try connecting again.')}")

    user_id = state_row.user_id
    db.delete(state_row)

    # Reconstruct flow, restore code verifier, exchange code for token
    flow = _make_flow()
    if state_row.code_verifier:
        flow.code_verifier = state_row.code_verifier
    try:
        flow.fetch_token(code=code)
    except Exception as exc:
        print(f"[mcp/callback] fetch_token FAILED: {exc}")
        return RedirectResponse(f"{return_to}?google_error={quote(f'Token exchange failed: {exc}')}")
    creds = flow.credentials
    print(f"[mcp/callback] token fetched OK, has refresh_token={bool(creds.refresh_token)}")

    # Upsert token for this user
    import uuid as _uuid
    try:
        uid = _uuid.UUID(user_id)
    except Exception:
        uid = user_id
    try:
        row = db.query(UserGoogleToken).filter(UserGoogleToken.user_id == uid).first()
        if row:
            row.token_json = creds.to_json()
            print(f"[mcp/callback] updated existing UserGoogleToken for user_id={user_id}")
        else:
            row = UserGoogleToken(user_id=uid, token_json=creds.to_json())
            db.add(row)
            print(f"[mcp/callback] inserted new UserGoogleToken for user_id={user_id}")
        db.commit()
        print(f"[mcp/callback] DB commit OK — redirecting to {return_to}")
    except Exception as exc:
        print(f"[mcp/callback] DB error: {exc}")
        return RedirectResponse(f"{return_to}?google_error={quote(f'Failed to save token: {exc}')}")

    return RedirectResponse(f"{return_to}?google_connected=1")


@router.get("/status")
def auth_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(UserGoogleToken).filter(UserGoogleToken.user_id == current_user.id).first()
    if not row:
        return {"gmail": False, "calendar": False}
    try:
        creds = Credentials.from_authorized_user_info(
            __import__("json").loads(row.token_json), SCOPES
        )
        connected = bool(creds.token or creds.refresh_token)
        return {"gmail": connected, "calendar": connected}
    except Exception:
        return {"gmail": False, "calendar": False}


@router.get("/debug")
def debug_token(
    token: str | None = None,
    db: Session = Depends(get_db),
):
    """Diagnostic endpoint — call with ?token=<jwt> to see your Google connection status."""
    import uuid as _uuid
    user = None
    if token:
        try:
            from backend.auth.jwt_utils import decode_jwt
            payload = decode_jwt(token)
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
        except Exception as e:
            return {"error": f"JWT decode failed: {e}"}
    if user is None:
        return {"error": "No valid token provided. Use ?token=<your_jwt>"}

    row = db.query(UserGoogleToken).filter(UserGoogleToken.user_id == user.id).first()
    if not row:
        # also try string comparison
        row = db.query(UserGoogleToken).filter(UserGoogleToken.user_id == str(user.id)).first()

    result = {
        "user_id": str(user.id),
        "email": user.email,
        "google_token_row_exists": row is not None,
    }
    if row:
        try:
            creds = Credentials.from_authorized_user_info(
                __import__("json").loads(row.token_json), SCOPES
            )
            result["token_valid"] = creds.valid
            result["has_refresh_token"] = bool(creds.refresh_token)
            result["scopes"] = list(creds.scopes or [])
        except Exception as e:
            result["token_parse_error"] = str(e)
    return result
