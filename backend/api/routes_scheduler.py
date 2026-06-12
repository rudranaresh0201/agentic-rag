from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks

from backend.scheduler.proactive import BRIEFING_FILE, morning_briefing, scheduler

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


@router.get("/briefing")
def get_briefing() -> dict:
    if not BRIEFING_FILE.exists():
        return {"text": None, "generated_at": None}
    try:
        data = json.loads(BRIEFING_FILE.read_text(encoding="utf-8"))
        return {"text": data.get("text"), "generated_at": data.get("generated_at")}
    except Exception:
        return {"text": None, "generated_at": None}


@router.post("/trigger")
def trigger_briefing(background_tasks: BackgroundTasks) -> dict:
    background_tasks.add_task(morning_briefing)
    return {"status": "triggered"}


@router.get("/status")
def get_status() -> dict:
    running = scheduler.running
    next_run = None
    if running:
        job = scheduler.get_job("morning_briefing")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()
    return {"running": running, "next_run": next_run}
