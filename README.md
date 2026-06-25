# Aria — Agentic AI Assistant

> A production-grade multi-agent AI assistant that doesn't just answer questions — it takes real actions on your behalf, with human approval before every write.

![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green) ![React](https://img.shields.io/badge/React-18-61DAFB) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What Aria Does

Aria is a conversational AI assistant wired up to real tools. You talk to it naturally, it figures out what you need, and it either answers immediately or shows you an **approval card** before taking any action — so nothing happens behind your back.

**Examples of things Aria can do:**

- *"Write a LinkedIn post about my new open-source project"* → drafts it, you approve, formats for posting
- *"Send an email to my team about tomorrow's standup being cancelled"* → composes, you edit inline, sends via your Gmail
- *"Generate a bubble sort implementation in Python and open a PR on my repo"* → writes code, shows diff, commits to a new branch and opens a PR — only after you confirm
- *"What did I work on this week?"* → reads your GitHub commits + calendar and writes your standup
- *"Analyze the sales data I uploaded"* → runs real pandas code against your documents, shows output
- *"Schedule a team sync next Monday at 3pm"* → shows event details, creates it in your Google Calendar on confirm

---

## Architecture

```
User Message
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                  Orchestrator Node                   │
│   (llama-3.3-70b — plans which agents to invoke)    │
└──────────────────────┬──────────────────────────────┘
                       │  routes to one or more of:
          ┌────────────┼──────────────────┐
          ▼            ▼                  ▼
    ┌──────────┐ ┌──────────┐    ┌──────────────────┐
    │  RAG /   │ │  Web     │    │   Write Agent    │
    │  Memory  │ │  Search  │    │   (10+ agents)   │
    └────┬─────┘ └────┬─────┘    └──────┬───────────┘
         │            │                 │
         └────────────┴────────┬────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Synthesis Node    │  ← merges all context
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │    Critic Node      │  ← self-checks answer
                    └──────────┬──────────┘
                               ▼
                      Response + optional
                      HITL Approval Card
```

**Write agents (require human confirmation before executing):**
`email_draft` · `gmail_send` · `social_media` · `code_writer` · `code_commit` · `pr_create` · `standup` · `resume_tailor` · `data_analyst` · `calendar_event`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + LangGraph StateGraph |
| Frontend | React 18 + Vite |
| Orchestration LLM | Groq `llama-3.3-70b-versatile` |
| Execution LLM | Groq `llama-3.1-8b-instant` |
| Vector Store | ChromaDB — HyDE + BM25 hybrid retrieval with cross-encoder reranking |
| Relational DB | Neon PostgreSQL |
| Auth | Google OAuth 2.0 + JWT (30-day) |
| Google Tools | Gmail API + Google Calendar API (per-user OAuth) |
| GitHub | PyGithub — per-user PAT |
| Episodic Memory | SQLite — cosine similarity + recency decay scoring |
| Containerization | Docker + docker-compose |

---

## Key Features

### Human-in-the-Loop (HITL)
Every write action — sending emails, committing code, creating PRs, scheduling events — generates an **approval card** in the UI. You review and edit the payload before confirming. Nothing executes automatically.

### Hybrid RAG Retrieval
Documents are retrieved using HyDE (Hypothetical Document Embeddings) query expansion followed by cross-encoder reranking. A tunable similarity threshold blocks the LLM from answering when no relevant context exists, preventing hallucination.

### Per-User Isolation
Every user gets an isolated namespace: separate ChromaDB collection, separate episodic memory, separate Google OAuth token, separate GitHub credentials. Multi-tenant from day one.

### Real-Time Code Diff Preview
The code-writer agent renders a syntax-highlighted diff before any commit. On confirm, it creates a new branch, commits all files, and opens a PR — in one atomic flow.

### Episodic Memory
Aria remembers context across sessions. Preferences, past requests, and task history are stored with cosine similarity + temporal decay so recent, relevant memories surface first.

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node 18+
- [Neon](https://neon.tech) PostgreSQL database (free tier works)
- [Groq](https://console.groq.com) API key (free tier works)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

cp ../.env.example .env
# Fill in your env vars

python -m uvicorn backend.app:app --host 127.0.0.1 --port 8003 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`, backend at `http://localhost:8003`.

### Docker

```bash
docker-compose up --build
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GROQ_API_KEY` | Groq API key |
| `GOOGLE_LOGIN_CLIENT_ID` | Google OAuth client ID for sign-in |
| `GOOGLE_LOGIN_CLIENT_SECRET` | Google OAuth client secret for sign-in |
| `GOOGLE_LOGIN_REDIRECT_URI` | `http://localhost:8003/auth/google/callback` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for Gmail/Calendar tools |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret for Gmail/Calendar tools |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8003/mcp/callback` |
| `GITHUB_TOKEN` | GitHub PAT (fallback for users without their own token) |
| `GITHUB_USERNAME` | Your GitHub username |
| `JWT_SECRET` | Random secret for signing JWTs — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `FRONTEND_URL` | Frontend origin URL (used for OAuth redirect) |
| `ALLOWED_ORIGINS` | CORS allowed origins |

See `.env.example` for the full list.

---

## Project Structure

```
agentic-rag/
├── backend/
│   ├── agent/
│   │   ├── graph.py            # LangGraph StateGraph definition + routing
│   │   ├── nodes.py            # All agent node implementations
│   │   ├── state.py            # Shared AgentState TypedDict
│   │   ├── github_agent.py     # GitHub API integration (per-user token)
│   │   └── code_executor.py    # Sandboxed Python/JS execution
│   ├── api/
│   │   ├── routes_agent.py     # POST /agent/query
│   │   ├── routes_actions.py   # HITL confirm/cancel endpoints
│   │   ├── routes_auth.py      # Google login + /auth/settings/github
│   │   └── routes_documents.py
│   ├── auth/
│   │   └── jwt_utils.py
│   ├── db/
│   │   ├── models.py           # SQLAlchemy models
│   │   └── postgres.py         # DB init + additive migrations
│   ├── mcp/
│   │   ├── google_tools.py     # Gmail + Calendar API calls
│   │   └── routes_mcp.py       # Per-user Google OAuth flow
│   ├── memory/
│   │   └── episodic_store.py
│   ├── ingestion.py            # Document chunking + embedding
│   └── retrieval.py            # HyDE + reranking pipeline
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ApprovalCard.jsx    # HITL action card with editable payload
│       │   ├── MessageBubble.jsx   # Chat message renderer
│       │   └── TopBar.jsx          # Status pills + GitHub settings modal
│       └── pages/
│           ├── Dashboard.jsx
│           └── Login.jsx
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Roadmap

- [ ] Persistent ChromaDB volume (currently ephemeral in Docker)
- [ ] GitHub OAuth (replace PAT with proper OAuth flow)
- [ ] Streaming responses (SSE)
- [ ] Voice input (Groq Whisper endpoint wired, UI pending)
- [ ] Google verification for Gmail/Calendar scopes
- [ ] Multi-modal: image uploads for analysis

---

## Author

[Rudra Naresh](https://github.com/rudranaresh0201) — electronics engineering student building at the intersection of agentic AI and real-world tool integration.
