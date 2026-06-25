from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.postgres import get_db
from backend.db.models import PendingAction
from backend.mcp.google_tools import send_email, create_calendar_event
from backend.agent.github_agent import create_pull_request, commit_files_to_branch

router = APIRouter(prefix="/actions", tags=["actions"])


# ── internal API (called by routes_agent after ainvoke completes) ──────────────

def register_action(action_type: str, payload: dict[str, Any], preview: str = "") -> str:
    """Deposit a pending action in PostgreSQL and return its ID."""
    from backend.db.postgres import get_db as _get_db
    action_id = str(uuid.uuid4())
    db = next(_get_db())
    try:
        row = PendingAction(
            action_id=action_id,
            type=action_type,
            payload=payload,
            preview=preview,
            status="pending",
        )
        db.add(row)
        db.commit()
    finally:
        db.close()
    return action_id


# ── HTTP endpoints ─────────────────────────────────────────────────────────────

class DepositRequest(BaseModel):
    type: str
    payload: dict[str, Any]
    preview: str = ""


@router.post("/pending")
def deposit_action(body: DepositRequest, db: Session = Depends(get_db)) -> dict:
    action_id = str(uuid.uuid4())
    row = PendingAction(
        action_id=action_id,
        type=body.type,
        payload=body.payload,
        preview=body.preview,
        status="pending",
    )
    db.add(row)
    db.commit()
    return {"action_id": action_id}


@router.get("/pending")
def list_pending(db: Session = Depends(get_db)) -> dict:
    rows = db.query(PendingAction).filter(PendingAction.status == "pending").all()
    return {"actions": [
        {
            "action_id": r.action_id,
            "type": r.type,
            "payload": r.payload,
            "preview": r.preview,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]}


class ConfirmRequest(BaseModel):
    payload: dict[str, Any] | None = None


@router.post("/confirm/{action_id}")
def confirm_action(action_id: str, body: ConfirmRequest | None = None, db: Session = Depends(get_db)) -> dict:
    action = db.query(PendingAction).filter(PendingAction.action_id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != "pending":
        raise HTTPException(status_code=409, detail=f"Action already {action.status}")

    payload = (body and body.payload) or action.payload
    try:
        if action.type == "send_email":
            result = send_email(
                to=payload.get("to", ""),
                subject=payload.get("subject", ""),
                body=payload.get("body", ""),
                user_id=payload.get("user_id", ""),
            )
        elif action.type == "create_calendar_event":
            result = create_calendar_event(
                title=payload.get("title", ""),
                start_datetime=payload.get("start_datetime", ""),
                end_datetime=payload.get("end_datetime", ""),
                description=payload.get("description", ""),
                attendees=payload.get("attendees") or [],
                user_id=payload.get("user_id", ""),
            )
        elif action.type == "create_pr":
            try:
                result = create_pull_request(
                    repo=payload.get("repo", ""),
                    title=payload.get("title", ""),
                    body=payload.get("body", ""),
                    head=payload.get("head", ""),
                    base=payload.get("base", "main"),
                    user_id=payload.get("user_id", ""),
                )
            except Exception as exc:
                msg = str(exc)
                if '"code": "invalid"' in msg and '"field": "head"' in msg:
                    head = payload.get("head", "?")
                    raise HTTPException(
                        status_code=422,
                        detail=f"Branch '{head}' doesn't exist on GitHub. Create the branch first, or use the code-writer flow which auto-creates it.",
                    )
                raise HTTPException(status_code=502, detail=msg)
        elif action.type == "code_diff_preview":
            repo           = payload.get("repo", "")
            branch         = payload.get("branch", "")
            base           = payload.get("base", "main")
            files          = payload.get("files", [])
            commit_message = payload.get("commit_message", "feat: generated code")

            try:
                commit_result = commit_files_to_branch(
                    repo=repo, branch=branch, base=base,
                    files=files, commit_message=commit_message,
                    user_id=payload.get("user_id", ""),
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"stage": "branch_commit", "reason": str(exc)},
                )

            pr_body = (
                "Auto-generated by Aria agent.\n\n"
                "**Files changed:**\n"
                + "\n".join(f"- `{f['path']}`" for f in files)
            )
            try:
                pr_result = create_pull_request(
                    repo=repo,
                    title=commit_message,
                    body=pr_body,
                    head=branch,
                    base=base,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"stage": "pr_create", "reason": str(exc)},
                )

            result = {
                "pr_url":          pr_result["pr_url"],
                "pr_number":       pr_result["pr_number"],
                "branch":          commit_result["branch"],
                "files_committed": commit_result.get("files_committed", []),
            }
        else:
            raise HTTPException(status_code=422, detail=f"Unknown action type: {action.type}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    action.status = "done"
    db.commit()
    return {"success": True, "action_id": action_id, "result": result}


@router.post("/cancel/{action_id}")
def cancel_action(action_id: str, db: Session = Depends(get_db)) -> dict:
    action = db.query(PendingAction).filter(PendingAction.action_id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    db.delete(action)
    db.commit()
    return {"cancelled": action_id}
