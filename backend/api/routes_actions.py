from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.mcp.google_tools import send_email, create_calendar_event
from backend.agent.github_agent import create_pull_request

# In-memory store — survives for the lifetime of the server process
_store: dict[str, dict[str, Any]] = {}

router = APIRouter(prefix="/actions", tags=["actions"])


# ── internal API (called by routes_agent after ainvoke completes) ──────────────

def register_action(action_type: str, payload: dict[str, Any], preview: str = "") -> str:
    """Deposit a pending action and return its ID. Called internally, not via HTTP."""
    action_id = str(uuid.uuid4())
    _store[action_id] = {
        "action_id": action_id,
        "type": action_type,
        "payload": payload,
        "preview": preview,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }
    return action_id


# ── HTTP endpoints ─────────────────────────────────────────────────────────────

class DepositRequest(BaseModel):
    type: str
    payload: dict[str, Any]
    preview: str = ""


@router.post("/pending")
def deposit_action(body: DepositRequest) -> dict:
    """External callers can also deposit actions directly via HTTP."""
    action_id = register_action(body.type, body.payload, body.preview)
    return {"action_id": action_id}


@router.get("/pending")
def list_pending() -> dict:
    """Return all actions still awaiting confirmation."""
    return {"actions": [v for v in _store.values() if v["status"] == "pending"]}


class ConfirmRequest(BaseModel):
    payload: dict[str, Any] | None = None


@router.post("/confirm/{action_id}")
def confirm_action(action_id: str, body: ConfirmRequest | None = None) -> dict:
    """Execute a pending action and mark it done.

    Optional body: {"payload": {...}} — if supplied, the edited payload from the
    ApprovalCard is used instead of the originally stored one, so field edits made
    by the user before clicking Confirm are honoured.
    """
    action = _store.get(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Action already {action['status']}")

    payload = (body and body.payload) or action["payload"]
    try:
        if action["type"] == "send_email":
            result = send_email(
                to=payload.get("to", ""),
                subject=payload.get("subject", ""),
                body=payload.get("body", ""),
            )
        elif action["type"] == "create_calendar_event":
            result = create_calendar_event(
                title=payload.get("title", ""),
                start_datetime=payload.get("start_datetime", ""),
                end_datetime=payload.get("end_datetime", ""),
                description=payload.get("description", ""),
                attendees=payload.get("attendees") or [],
            )
        elif action["type"] == "create_pr":
            result = create_pull_request(
                repo=payload.get("repo", ""),
                title=payload.get("title", ""),
                body=payload.get("body", ""),
                head=payload.get("head", ""),
                base=payload.get("base", "main"),
            )
        else:
            raise HTTPException(status_code=422, detail=f"Unknown action type: {action['type']}")
    except HTTPException:
        raise
    except Exception as exc:
        # Leave as pending so the user can retry after fixing the underlying issue
        raise HTTPException(status_code=502, detail=str(exc))

    action["status"] = "done"
    return {"success": True, "action_id": action_id, "result": result}


@router.post("/cancel/{action_id}")
def cancel_action(action_id: str) -> dict:
    """Remove a pending action without executing it."""
    if action_id not in _store:
        raise HTTPException(status_code=404, detail="Action not found")
    del _store[action_id]
    return {"cancelled": action_id}
