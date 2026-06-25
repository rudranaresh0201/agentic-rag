from __future__ import annotations

import os


def get_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if not raw:
        # Always include both localhost and 127.0.0.1 variants — they have separate
        # localStorage scopes in browsers, and users may access the app on either.
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def get_max_upload_bytes() -> int:
    try:
        max_mb = int(os.getenv("MAX_UPLOAD_MB", "50"))
    except ValueError:
        max_mb = 50
    return max(1, max_mb) * 1024 * 1024


# ── RAG Retrieval ──────────────────────────────────────────
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "8"))
RAG_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "1200"))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "100"))
RAG_RERANK_WINDOW = int(os.getenv("RAG_RERANK_WINDOW", "500"))
RAG_RRF_K = int(os.getenv("RAG_RRF_K", "60"))

# ── Agent / LLM ────────────────────────────────────────────
# LLM_MODEL accepts any OpenRouter model id; falls back to legacy GROQ_MODEL env var
LLM_MODEL = os.getenv("LLM_MODEL") or os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_MODEL = LLM_MODEL  # keep old name for any stale imports
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
AGENT_WEB_RESULTS = int(os.getenv("AGENT_WEB_RESULTS", "5"))

# ── Google OAuth (MCP — Gmail/Calendar API access) ──────────
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8003/mcp/callback")

# ── Google OAuth (Login — user identity) ────────────────────
GOOGLE_LOGIN_CLIENT_ID = os.getenv("GOOGLE_LOGIN_CLIENT_ID", "")
GOOGLE_LOGIN_CLIENT_SECRET = os.getenv("GOOGLE_LOGIN_CLIENT_SECRET", "")
GOOGLE_LOGIN_REDIRECT_URI = os.getenv(
    "GOOGLE_LOGIN_REDIRECT_URI", "http://localhost:8003/auth/google/callback"
)

# ── Auth / JWT ───────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── YouTube ─────────────────────────────────────────────────
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")

# ── GitHub ──────────────────────────────────────────────────
GITHUB_TOKEN    = os.getenv("GITHUB_TOKEN", "")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "")

# ── Scheduler ───────────────────────────────────────────────
BRIEFING_HOUR = int(os.getenv("BRIEFING_HOUR", "8"))

# ── LangSmith Tracing ────────────────────────────────────────
# LangChain/LangGraph auto-detect these from os.environ — no explicit wiring needed.
LANGCHAIN_TRACING_V2 = os.getenv("LANGCHAIN_TRACING_V2", "false")
LANGCHAIN_API_KEY    = os.getenv("LANGCHAIN_API_KEY", "")
LANGCHAIN_PROJECT    = os.getenv("LANGCHAIN_PROJECT", "aria-production")
