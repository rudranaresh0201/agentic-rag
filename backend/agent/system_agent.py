from __future__ import annotations

import json
import platform
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psutil

REMINDERS_FILE = Path(__file__).resolve().parent.parent / "scheduler" / "reminders.json"

_APP_COMMANDS: dict[str, str] = {
    "code":     "code",
    "vscode":   "code",
    "chrome":   "chrome",
    "notepad":  "notepad",
    "explorer": "explorer",
    "spotify":  "spotify",
    "terminal": "wt",
    "cmd":      "cmd",
    "firefox":  "firefox",
    "word":     "winword",
    "excel":    "excel",
}


def get_system_info() -> dict:
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("C:\\" if platform.system() == "Windows" else "/")
    boot_time = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
    uptime_secs = int((datetime.now(timezone.utc) - boot_time).total_seconds())
    hours, rem = divmod(uptime_secs, 3600)
    return {
        "os": f"{platform.system()} {platform.release()}",
        "cpu_percent": psutil.cpu_percent(interval=0.5),
        "ram_used": round(vm.used / 1024 ** 3, 2),
        "ram_total": round(vm.total / 1024 ** 3, 2),
        "disk_used": round(disk.used / 1024 ** 3, 2),
        "disk_total": round(disk.total / 1024 ** 3, 2),
        "uptime": f"{hours}h {rem // 60}m",
    }


def get_current_time() -> dict:
    now = datetime.now()
    tz_name = datetime.now(timezone.utc).astimezone().tzname() or "local"
    return {
        "time": now.strftime("%H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "timezone": tz_name,
        "day_of_week": now.strftime("%A"),
    }


def list_running_processes(top_n: int = 10) -> list[dict]:
    procs: list[dict] = []
    for proc in psutil.process_iter(["name", "pid", "cpu_percent", "memory_percent"]):
        try:
            info = proc.info
            procs.append({
                "name": info["name"],
                "pid": info["pid"],
                "cpu": round(info["cpu_percent"] or 0.0, 1),
                "memory": round(info["memory_percent"] or 0.0, 2),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda p: p["cpu"], reverse=True)
    return procs[:top_n]


def open_application(app_name: str) -> dict:
    key = app_name.lower().strip()
    command = _APP_COMMANDS.get(key, key)
    try:
        if platform.system() == "Windows":
            subprocess.Popen(f"start {command}", shell=True)
        else:
            subprocess.Popen(command, shell=True)
        return {"status": "launched", "app": app_name}
    except Exception as exc:
        return {"status": "error", "app": app_name, "error": str(exc)}


def set_reminder(message: str, minutes: int) -> dict:
    import requests as http_requests
    from backend.scheduler.proactive import scheduler

    run_date = datetime.now() + timedelta(minutes=minutes)
    job_id = f"reminder_{int(run_date.timestamp())}"

    def _fire() -> None:
        try:
            http_requests.post(
                "http://127.0.0.1:8003/voice/speak",
                json={"text": f"Reminder: {message}"},
                timeout=5,
            )
        except Exception:
            pass
        _persist_reminder(message, "fired")

    scheduler.add_job(_fire, "date", run_date=run_date, id=job_id, replace_existing=True)
    _persist_reminder(message, "scheduled", minutes)
    return {"status": "scheduled", "message": message, "in_minutes": minutes}


def _persist_reminder(message: str, status: str, minutes: int = 0) -> None:
    REMINDERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    reminders: list[dict] = []
    if REMINDERS_FILE.exists():
        try:
            reminders = json.loads(REMINDERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            reminders = []
    reminders.append({
        "message": message,
        "status": status,
        "minutes": minutes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    REMINDERS_FILE.write_text(
        json.dumps(reminders, ensure_ascii=False, indent=2), encoding="utf-8"
    )
