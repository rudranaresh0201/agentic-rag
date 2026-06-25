from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "")

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    return _engine


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a SQLAlchemy session and closes it after the request."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_get_engine())
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all ORM tables that don't yet exist. No-op if DATABASE_URL is unset."""
    if not DATABASE_URL:
        return
    from backend.db.models import Base  # local import avoids circular import at module load
    engine = _get_engine()
    Base.metadata.create_all(bind=engine)

    # Additive column migrations — safe to run on every startup (IF NOT EXISTS guard)
    _migrations = [
        "ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS return_to VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS github_token VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR",
    ]
    with engine.connect() as conn:
        for sql in _migrations:
            try:
                conn.execute(__import__("sqlalchemy").text(sql))
                conn.commit()
            except Exception:
                conn.rollback()
