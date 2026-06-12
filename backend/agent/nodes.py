from __future__ import annotations

import json
import re
import os

from langchain_groq import ChatGroq
from tavily import TavilyClient

from backend.retrieval import retrieve_chunks, retrieve_chunks_hyde
from backend.llm import generate_answer
from backend.agent.state import AgentState
import requests as http_requests

from backend.config import GROQ_MODEL, RAG_TOP_K, AGENT_WEB_RESULTS, YOUTUBE_API_KEY
from backend.mcp.google_tools import (
    get_recent_emails,
    search_emails,
    get_calendar_events,
    create_calendar_event,
)
llm = ChatGroq(model=GROQ_MODEL, api_key=os.getenv("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

_PLAY_KEYWORDS = ("play ", "put on ", "show me ", "watch ")

def router_node(state: AgentState) -> AgentState:
    query_lower = state["query"].lower()
    if any(kw in query_lower for kw in _PLAY_KEYWORDS):
        route = "media"
    else:
        prompt = f"""Classify this query into exactly one word: rag, web, both, gmail, calendar, or unclear.

Rules:
- rag: questions about internal documents, uploaded files, company policies, specific stored knowledge
- web: current events, live prices, news, anything time-sensitive
- both: needs internal context AND live web data together
- gmail: reading, searching, or sending emails
- calendar: viewing, scheduling, or creating calendar events
- unclear: genuinely cannot determine intent

Default to rag unless the query clearly needs another source.

Query: {state['query']}
Reply with one word only."""
        result = llm.invoke(prompt)
        route = result.content.strip().lower()
        if route not in ["rag", "web", "both", "gmail", "calendar", "unclear"]:
            route = "rag"
    return {**state, "route": route, "agent_steps": state["agent_steps"] + [f"🔀 Router → {route}"]}

def rag_node(state: AgentState) -> AgentState:
    from backend.db import get_embedder

    query = state["query"]

    # Generate a hypothetical answer that would look like a matching document (HyDE)
    hyp_prompt = f"""Write a detailed ~150-word paragraph that would perfectly answer this question.
Be specific and factual, using the kind of precise language found in technical documents.

Question: {query}
Paragraph:"""
    hyp_answer = llm.invoke(hyp_prompt).content.strip()

    # Encode the hypothetical answer as a document (no query prefix) so it lands in document space
    embed_model = get_embedder()
    hyp_embedding = embed_model.encode(
        hyp_answer,
        show_progress_bar=False,
        normalize_embeddings=True,
    ).tolist()

    result = retrieve_chunks_hyde(query=query, hypothetical_embedding=hyp_embedding, top_k=RAG_TOP_K)
    chunks = [
        {
            "text": c["text"],
            "source": c.get("doc_id", ""),
            "filename": c.get("file", "") or c.get("metadata", {}).get("file", "") or c.get("metadata", {}).get("source", ""),
            "score": c.get("score"),
            "page": c.get("page"),
        }
        for c in result["chunks"]
    ]
    return {**state, "rag_results": chunks, "agent_steps": state["agent_steps"] + [f"📚 RAG (HyDE) → {len(chunks)} chunks retrieved"]}

def web_node(state: AgentState) -> AgentState:
    results = tavily_client.search(query=state["query"], max_results=AGENT_WEB_RESULTS)
    web_docs = [
        {"text": r["content"], "source": r["url"], "title": r.get("title", "")}
        for r in results.get("results", [])
    ]
    return {**state, "web_results": web_docs, "agent_steps": state["agent_steps"] + [f"🌐 Web → {len(web_docs)} results"]}

def memory_node(state: AgentState) -> AgentState:
    from backend.memory.episodic_store import search_memories, add_memory

    # Post-synthesis run: extract facts from final_answer and persist them
    final_answer = state.get("final_answer", "")
    if final_answer and not state.get("pending_action"):
        extract_prompt = f"""Extract key facts from this answer as a JSON array of short statements.
Each statement must be a single complete sentence useful as future reference.
Return ONLY a valid JSON array of strings, max 5 items.

Answer: {final_answer[:1500]}

JSON:"""
        n_written = 0
        try:
            raw = llm.invoke(extract_prompt).content.strip()
            match = re.search(r'\[.*?\]', raw, re.DOTALL)
            if match:
                facts = json.loads(match.group())
                for fact in facts:
                    if isinstance(fact, str) and len(fact.strip()) > 15:
                        add_memory(fact.strip())
                        n_written += 1
        except Exception:
            pass
        return {
            **state,
            "agent_steps": state["agent_steps"] + [f"💾 Memory → {n_written} facts stored"],
        }

    # Pre-synthesis run: search for relevant memories and load them into state
    memories = search_memories(query=state["query"], top_k=5)
    return {
        **state,
        "memory_context": memories,
        "agent_steps": state["agent_steps"] + [f"🧠 Memory → {len(memories)} relevant memories loaded"],
    }


def synthesis_node(state: AgentState) -> AgentState:
    _done_step = ["✅ Synthesis complete"]

    # Fast path: pure media success — no LLM call needed
    if (
        state.get("media_result")
        and not state.get("rag_results")
        and not state.get("web_results")
        and not state.get("gmail_results")
        and not state.get("calendar_results")
        and not state.get("pending_action")
    ):
        title = state["media_result"].get("title", "the requested content")
        return {**state, "final_answer": f"Now playing: {title}", "agent_steps": state["agent_steps"] + _done_step}

    context_parts = []
    if state.get("memory_context"):
        memory_lines = [f"- {m['content']}" for m in state["memory_context"]]
        context_parts.append("Previously known context:\n" + "\n".join(memory_lines))
    if state.get("rag_results"):
        context_parts.append("Internal Docs:\n" + "\n".join([f"- {r['text']}" for r in state["rag_results"]]))
    if state.get("web_results"):
        context_parts.append("Web Results:\n" + "\n".join([f"- {r['title']}: {r['text']}" for r in state["web_results"]]))
    if state.get("gmail_results"):
        lines = [
            f"- From: {e['sender']} | Subject: {e['subject']} | {e['date']}\n  {e['snippet']}"
            for e in state["gmail_results"]
        ]
        context_parts.append("Gmail Emails:\n" + "\n".join(lines))
    if state.get("calendar_results"):
        lines = [
            f"- {e['title']} | {e['start']} → {e['end']} | {e.get('location', '')}"
            for e in state["calendar_results"]
        ]
        context_parts.append("Calendar Events:\n" + "\n".join(lines))
    if state.get("media_result"):
        mr = state["media_result"]
        context_parts.append(f"Media:\n  Playing: {mr.get('title', '')}")

    pending = state.get("pending_action")
    if pending:
        action_type = pending.get("type", "")
        payload = pending.get("payload", {})
        if action_type == "send_email":
            context_parts.append(
                f"Draft Email (awaiting confirmation):\n"
                f"  To: {payload.get('to', '')}\n"
                f"  Subject: {payload.get('subject', '')}\n"
                f"  Body: {payload.get('body', '')}"
            )
        elif action_type == "create_calendar_event":
            context_parts.append(
                f"Draft Calendar Event (awaiting confirmation):\n"
                f"  Title: {payload.get('title', '')}\n"
                f"  Start: {payload.get('start_datetime', '')}\n"
                f"  End: {payload.get('end_datetime', '')}\n"
                f"  Attendees: {', '.join(payload.get('attendees', []))}"
            )

    # Pass-through: no data collected and no pending action
    # (e.g., upstream node failed, auth error). Keep whatever final_answer is already set.
    if not context_parts and not pending:
        return {**state, "agent_steps": state["agent_steps"] + _done_step}

    full_context = "\n\n".join(context_parts)

    if pending:
        prompt = f"""You are a helpful assistant. Present the draft action below clearly to the user and ask them to confirm before proceeding.

Draft:
{full_context}

Query: {state['query']}

Response (ask for confirmation):"""
    else:
        prompt = f"""You are a precise research assistant. Answer the query completely using the context below.

Rules:
- List ALL relevant items found, never stop at the first match
- Use bullet points for lists
- Report everything present even if context is partial
- Never truncate lists or stop after one example

Context:
{full_context}

Query: {state['query']}

Comprehensive answer:"""

    answer = llm.invoke(prompt).content.strip()
    answer = re.sub(r'\*+', '', answer).strip()
    return {**state, "final_answer": answer, "agent_steps": state["agent_steps"] + _done_step}

def clarify_node(state: AgentState) -> AgentState:
    return {**state, "final_answer": "Could you clarify your query? I need more context to know whether to search internal docs or the web.", "agent_steps": state["agent_steps"] + ["❓ Clarification requested"]}


def gmail_node(state: AgentState) -> AgentState:
    query = state["query"]

    intent_prompt = f"""Classify this Gmail request. Reply with exactly one word: send, search, or read.
- send: user wants to compose or send an email
- search: user wants to find specific emails by keyword, sender, or subject
- read: user wants to see recent emails

Query: {query}
Reply with one word only:"""
    intent = llm.invoke(intent_prompt).content.strip().lower()
    if intent not in ("send", "search", "read"):
        intent = "read"

    if intent == "send":
        extract_prompt = f"""Extract email fields from this request as JSON only.
Return exactly this shape: {{"to": "...", "subject": "...", "body": "..."}}
If a field cannot be determined, use an empty string.
Request: {query}
JSON:"""
        raw = llm.invoke(extract_prompt).content.strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        try:
            payload = json.loads(match.group()) if match else {}
        except json.JSONDecodeError:
            payload = {}
        payload.setdefault("to", "")
        payload.setdefault("subject", "")
        payload.setdefault("body", "")
        preview = f"Send email to {payload.get('to', '?')} — Subject: {payload.get('subject', '(no subject)')}"
        return {
            **state,
            "pending_action": {"type": "send_email", "payload": payload, "preview": preview},
            "agent_steps": state["agent_steps"] + ["📧 Gmail → draft ready for confirmation"],
        }

    try:
        if intent == "search":
            results = search_emails(query=query)
        else:
            results = get_recent_emails()
    except RuntimeError as exc:
        return {
            **state,
            "gmail_results": [],
            "agent_steps": state["agent_steps"] + [f"📧 Gmail → auth required: {exc}"],
        }

    return {
        **state,
        "gmail_results": results,
        "agent_steps": state["agent_steps"] + [f"📧 Gmail → {len(results)} emails retrieved"],
    }


def calendar_node(state: AgentState) -> AgentState:
    query = state["query"]

    intent_prompt = f"""Classify this calendar request. Reply with exactly one word: create or read.
- create: user wants to schedule, add, or create a calendar event
- read: user wants to view or list upcoming events

Query: {query}
Reply with one word only:"""
    intent = llm.invoke(intent_prompt).content.strip().lower()
    if intent not in ("create", "read"):
        intent = "read"

    if intent == "create":
        extract_prompt = f"""Extract calendar event details from this request as JSON only.
Return exactly this shape: {{"title": "...", "start_datetime": "...", "end_datetime": "...", "description": "...", "attendees": []}}
Use ISO 8601 format for datetimes (e.g. 2024-01-15T14:00:00). Use empty strings or arrays when a field is unclear.
Request: {query}
JSON:"""
        raw = llm.invoke(extract_prompt).content.strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        try:
            payload = json.loads(match.group()) if match else {}
        except json.JSONDecodeError:
            payload = {}
        payload.setdefault("title", "")
        payload.setdefault("start_datetime", "")
        payload.setdefault("end_datetime", "")
        payload.setdefault("description", "")
        payload.setdefault("attendees", [])
        preview = f"Create event '{payload.get('title', 'Untitled')}' on {payload.get('start_datetime', '?')}"
        return {
            **state,
            "pending_action": {"type": "create_calendar_event", "payload": payload, "preview": preview},
            "agent_steps": state["agent_steps"] + ["📅 Calendar → draft event ready for confirmation"],
        }

    try:
        results = get_calendar_events()
    except RuntimeError as exc:
        return {
            **state,
            "calendar_results": [],
            "agent_steps": state["agent_steps"] + [f"📅 Calendar → auth required: {exc}"],
        }

    return {
        **state,
        "calendar_results": results,
        "agent_steps": state["agent_steps"] + [f"📅 Calendar → {len(results)} events retrieved"],
    }


def media_node(state: AgentState) -> AgentState:
    query = state["query"]

    classify_prompt = f"""Classify this media request. Reply with exactly one word: music or video.
- music: song, track, album, artist, listen, audio
- video: video, movie, show, tutorial, clip, watch

Query: {query}
Reply with one word only:"""
    media_type = llm.invoke(classify_prompt).content.strip().lower()
    if media_type not in ("music", "video"):
        media_type = "video"

    search_q = f"{query} official audio" if media_type == "music" else query

    try:
        resp = http_requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": search_q,
                "type": "video",
                "key": YOUTUBE_API_KEY,
                "maxResults": 1,
            },
            timeout=10,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            return {
                **state,
                "media_result": None,
                "final_answer": "I couldn't find a video for that. Try rephrasing your request.",
                "agent_steps": state["agent_steps"] + ["🎬 Media → no results found"],
            }
        item = items[0]
        video_id = item["id"]["videoId"]
        snippet = item["snippet"]
        title = snippet.get("title", "")
        thumbnail = snippet.get("thumbnails", {}).get("high", {}).get("url", "")
        media_result = {"type": "youtube", "video_id": video_id, "title": title, "thumbnail": thumbnail}
        return {
            **state,
            "media_result": media_result,
            "agent_steps": state["agent_steps"] + [f"🎬 Media → playing: {title}"],
        }
    except Exception as exc:
        return {
            **state,
            "media_result": None,
            "final_answer": "Something went wrong fetching the video. Please try again.",
            "agent_steps": state["agent_steps"] + [f"🎬 Media → error: {exc}"],
        }


def orchestrator_node(state: AgentState) -> AgentState:
    query = state["query"]
    plan_prompt = f"""Analyze this user query and produce the shortest effective execution plan.

Available agents:
- rag: search internal uploaded documents
- web: search the internet for current information
- gmail: read, search, or compose emails
- calendar: view events or create calendar entries
- media: play music or video (YouTube)
- code: analyze, explain, or write code (listed for planning; routes to rag if no code node)

Rules:
- Minimum agents needed — prefer one unless the query explicitly needs multiple sources
- Order matters: information-gathering agents run before cross-referencing ones
- "search my emails about X then find related docs" → ["gmail", "rag"]
- "play X" or media requests → ["media"]
- Simple document/knowledge questions → ["rag"]
- Current events, live data → ["web"]

Output ONLY a JSON object with no explanation, no markdown:
{{"plan": ["agent1", "agent2"]}}

Query: {query}"""

    raw = llm.invoke(plan_prompt).content.strip()

    try:
        clean = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
        parsed = json.loads(clean)
        plan = parsed.get("plan", [])
        # executable nodes only — "code" is recognised by the LLM but not yet implemented
        executable = {"rag", "web", "gmail", "calendar", "media"}
        plan = [s for s in plan if s in executable]
        if not plan:
            plan = ["rag"]
    except (json.JSONDecodeError, AttributeError, KeyError):
        plan = ["rag"]

    route = plan[0]
    return {
        **state,
        "mcp_plan": plan,
        "plan_index": 0,
        "route": route,
        "agent_steps": state["agent_steps"] + [f"🧠 Orchestrator → plan: [{', '.join(plan)}]"],
    }


def advance_plan_node(state: AgentState) -> AgentState:
    """Increments plan_index after each agent node completes."""
    return {**state, "plan_index": state.get("plan_index", 0) + 1}
