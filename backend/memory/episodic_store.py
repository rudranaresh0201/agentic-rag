from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

DB_PATH = Path(__file__).resolve().parent / "episodic.db"
_db_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db_lock:
        with _get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    content      TEXT    NOT NULL,
                    embedding_json TEXT  NOT NULL,
                    access_count INTEGER DEFAULT 0,
                    last_accessed TEXT,
                    created_at   TEXT    NOT NULL,
                    decay_score  REAL    DEFAULT 0.0
                )
            """)
            conn.commit()


def _embed(text: str) -> list[float]:
    # Reuse the project's shared embedder (BAAI/bge-base-en-v1.5 by default)
    from backend.db import embed_texts
    return embed_texts([text])[0]


def _cosine_sim(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0


def _decay(access_count: int, created_at: str) -> float:
    created = datetime.fromisoformat(created_at)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - created).total_seconds() / 86400
    return access_count / (days + 1)


def add_memory(content: str) -> int:
    init_db()
    embedding = _embed(content)
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock:
        with _get_conn() as conn:
            cursor = conn.execute(
                """INSERT INTO memories (content, embedding_json, access_count, last_accessed, created_at, decay_score)
                   VALUES (?, ?, 0, ?, ?, 0.0)""",
                (content, json.dumps(embedding), now, now),
            )
            conn.commit()
            return cursor.lastrowid


def update_access(memory_id: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock:
        with _get_conn() as conn:
            row = conn.execute("SELECT * FROM memories WHERE id = ?", (memory_id,)).fetchone()
            if not row:
                return
            new_count = row["access_count"] + 1
            new_decay = _decay(new_count, row["created_at"])
            conn.execute(
                "UPDATE memories SET access_count=?, last_accessed=?, decay_score=? WHERE id=?",
                (new_count, now, new_decay, memory_id),
            )
            conn.commit()


def search_memories(query: str, top_k: int = 5) -> list[dict]:
    init_db()
    query_emb = _embed(query)

    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM memories").fetchall()

    if not rows:
        return []

    scored = sorted(
        [(_cosine_sim(query_emb, json.loads(r["embedding_json"])), dict(r)) for r in rows],
        key=lambda x: x[0],
        reverse=True,
    )

    results = []
    for sim, row in scored[:top_k]:
        update_access(row["id"])
        results.append({
            "id": row["id"],
            "content": row["content"],
            "score": round(sim, 4),
            "access_count": row["access_count"] + 1,
            "created_at": row["created_at"],
        })
    return results


def list_memories() -> list[dict]:
    init_db()
    now_ts = datetime.now(timezone.utc)
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, content, access_count, last_accessed, created_at FROM memories"
        ).fetchall()
    results = []
    for row in rows:
        d = dict(row)
        d["decay_score"] = round(_decay(row["access_count"], row["created_at"]), 4)
        results.append(d)
    return sorted(results, key=lambda x: x["decay_score"], reverse=True)


def delete_memory(memory_id: int) -> bool:
    init_db()
    with _db_lock:
        with _get_conn() as conn:
            cursor = conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
            conn.commit()
            return cursor.rowcount > 0


def prune_memories(min_decay: float = 0.01) -> int:
    init_db()
    with _get_conn() as conn:
        rows = conn.execute("SELECT id, access_count, created_at FROM memories").fetchall()
    ids_to_delete = [
        r["id"] for r in rows if _decay(r["access_count"], r["created_at"]) < min_decay
    ]
    if ids_to_delete:
        with _db_lock:
            with _get_conn() as conn:
                conn.executemany("DELETE FROM memories WHERE id = ?", [(i,) for i in ids_to_delete])
                conn.commit()
    return len(ids_to_delete)
