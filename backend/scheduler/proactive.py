from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests as http_requests
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.config import BRIEFING_HOUR, GROQ_MODEL
from backend.core.logging import get_logger

logger = get_logger(__name__)

BRIEFING_FILE = Path(__file__).resolve().parent / "last_briefing.json"

scheduler = AsyncIOScheduler()


def _call_groq(context: str) -> str:
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if not groq_key:
        return "GROQ_API_KEY not configured — raw context:\n\n" + context
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a personal assistant. Given these calendar events, recent emails, "
                    "and document context, write a concise morning briefing in 3-5 bullet points. "
                    "Be specific and actionable."
                ),
            },
            {"role": "user", "content": context[:8000]},
        ],
        "temperature": 0.3,
        "max_tokens": 512,
    }
    r = http_requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def morning_briefing() -> None:
    logger.info("[Scheduler] Running morning briefing")
    sections: list[str] = []

    # 1. Calendar events
    try:
        from backend.mcp.google_tools import get_calendar_events
        events = get_calendar_events(days_ahead=1)
        if events:
            lines = [f"- {e['title']} at {e['start']}" for e in events[:10]]
            sections.append("CALENDAR EVENTS TODAY:\n" + "\n".join(lines))
        else:
            sections.append("CALENDAR EVENTS TODAY: None scheduled.")
    except Exception as exc:
        logger.warning("[Scheduler] Calendar unavailable: %s", exc)
        sections.append("CALENDAR EVENTS TODAY: Unavailable (not authenticated).")

    # 2. Recent emails
    try:
        from backend.mcp.google_tools import get_recent_emails
        emails = get_recent_emails(max_results=5)
        if emails:
            lines = [
                f"- {e.get('subject', '(no subject)')} from {e.get('sender', '?')}"
                for e in emails
            ]
            sections.append("RECENT EMAILS:\n" + "\n".join(lines))
        else:
            sections.append("RECENT EMAILS: None.")
    except Exception as exc:
        logger.warning("[Scheduler] Emails unavailable: %s", exc)
        sections.append("RECENT EMAILS: Unavailable (not authenticated).")

    # 3. Document context
    try:
        from backend.retrieval import retrieve_chunks
        result = retrieve_chunks(query="important tasks priorities today", top_k=3)
        doc_context = result.get("context", "").strip()
        if doc_context and result.get("status") == "ok":
            sections.append("DOCUMENT CONTEXT:\n" + doc_context[:2000])
        else:
            sections.append("DOCUMENT CONTEXT: No relevant documents found.")
    except Exception as exc:
        logger.warning("[Scheduler] Retrieval unavailable: %s", exc)
        sections.append("DOCUMENT CONTEXT: Unavailable.")

    context = "\n\n".join(sections)

    # 4. Generate briefing via LLM
    try:
        briefing = _call_groq(context)
    except Exception as exc:
        logger.error("[Scheduler] LLM call failed: %s", exc)
        briefing = context

    now = datetime.now(timezone.utc).isoformat()

    # 5. Store in episodic memory
    try:
        from backend.memory.episodic_store import add_memory
        add_memory(f"[Morning Briefing {now[:10]}]\n{briefing}")
    except Exception as exc:
        logger.warning("[Scheduler] Episodic store write failed: %s", exc)

    # 6. Persist to JSON for the API
    try:
        BRIEFING_FILE.parent.mkdir(parents=True, exist_ok=True)
        BRIEFING_FILE.write_text(
            json.dumps({"text": briefing, "generated_at": now}, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info("[Scheduler] Briefing saved to %s", BRIEFING_FILE)
    except Exception as exc:
        logger.error("[Scheduler] Failed to save briefing file: %s", exc)


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        morning_briefing,
        CronTrigger(hour=BRIEFING_HOUR, minute=0),
        id="morning_briefing",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] Started — daily briefing at %02d:00", BRIEFING_HOUR)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")
