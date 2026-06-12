from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

TOKEN_PATH = Path(__file__).resolve().parent / "token.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]


def _get_credentials() -> Credentials:
    if not TOKEN_PATH.exists():
        raise RuntimeError("Not authenticated. Visit /mcp/auth to connect your Google account.")
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())
    return creds


def _extract_body(payload: dict) -> str:
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain":
            result = _extract_body(part)
            if result:
                return result
    return ""


def _parse_message(service: Any, message_id: str) -> dict:
    msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
    headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
    return {
        "id": message_id,
        "subject": headers.get("Subject", ""),
        "sender": headers.get("From", ""),
        "snippet": msg.get("snippet", ""),
        "date": headers.get("Date", ""),
        "body": _extract_body(msg["payload"]),
    }


def get_recent_emails(max_results: int = 10) -> list[dict]:
    creds = _get_credentials()
    service = build("gmail", "v1", credentials=creds)
    result = service.users().messages().list(userId="me", maxResults=max_results).execute()
    return [_parse_message(service, m["id"]) for m in result.get("messages", [])]


def search_emails(query: str, max_results: int = 5) -> list[dict]:
    creds = _get_credentials()
    service = build("gmail", "v1", credentials=creds)
    result = service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
    return [_parse_message(service, m["id"]) for m in result.get("messages", [])]


def send_email(to: str, subject: str, body: str) -> dict:
    creds = _get_credentials()
    service = build("gmail", "v1", credentials=creds)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {"success": True, "message_id": sent["id"]}


def get_calendar_events(days_ahead: int = 7) -> list[dict]:
    creds = _get_credentials()
    service = build("calendar", "v3", credentials=creds)
    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=days_ahead)).isoformat()
    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=50,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    return [
        {
            "id": e["id"],
            "title": e.get("summary", ""),
            "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
            "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", "")),
            "location": e.get("location", ""),
            "description": e.get("description", ""),
        }
        for e in result.get("items", [])
    ]


def create_calendar_event(
    title: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    attendees: list[str] | None = None,
) -> dict:
    creds = _get_credentials()
    service = build("calendar", "v3", credentials=creds)
    event_body: dict = {
        "summary": title,
        "description": description,
        "start": {"dateTime": start_datetime, "timeZone": "UTC"},
        "end": {"dateTime": end_datetime, "timeZone": "UTC"},
    }
    if attendees:
        event_body["attendees"] = [{"email": a} for a in attendees]
    created = service.events().insert(calendarId="primary", body=event_body).execute()
    return {
        "success": True,
        "event_id": created["id"],
        "link": created.get("htmlLink", ""),
    }
