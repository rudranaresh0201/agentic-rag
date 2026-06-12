from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from backend.agent.graph import agent_graph
from backend.agent.state import AgentState
from backend.api.routes_actions import register_action

router = APIRouter(prefix="/agent", tags=["agent"])

class AgentRequest(BaseModel):
    query: str

_EMPTY_STATE_BASE = {
    "messages": [],
    "route": "rag",
    "rag_results": [],
    "web_results": [],
    "gmail_results": [],
    "calendar_results": [],
    "pending_action": None,
    "mcp_plan": [],
    "plan_index": 0,
    "media_result": None,
    "memory_context": [],
    "final_answer": "",
    "agent_steps": [],
}


def _initial_state(query: str) -> AgentState:
    return {**_EMPTY_STATE_BASE, "query": query}  # type: ignore[return-value]


def _maybe_register(pending: dict | None) -> str | None:
    """If the agent produced a pending action, deposit it in the actions store."""
    if pending and pending.get("type"):
        return register_action(
            action_type=pending["type"],
            payload=pending.get("payload", {}),
            preview=pending.get("preview", ""),
        )
    return None


@router.post("/query")
async def agent_query(req: AgentRequest):
    result = await agent_graph.ainvoke(_initial_state(req.query))
    pending = result.get("pending_action")
    action_id = _maybe_register(pending)
    return {
        "answer": result["final_answer"],
        "route": result["route"],
        "steps": result["agent_steps"],
        "rag_sources": [r.get("filename") or r.get("source") for r in result.get("rag_results", [])],
        "web_sources": [r.get("source") for r in result.get("web_results", [])],
        "media_result": result.get("media_result"),
        "gmail_results": result.get("gmail_results", []),
        "calendar_results": result.get("calendar_results", []),
        "pending_action": pending,
        "action_id": action_id,
        "mcp_plan": result.get("mcp_plan", []),
    }

@router.post("/query/stream")
async def agent_query_stream(req: AgentRequest):
    _STREAM_NODES = {"router", "rag", "web", "gmail", "calendar", "media", "synthesis", "clarify"}

    async def event_generator():
        async for event in agent_graph.astream_events(_initial_state(req.query), version="v2"):
            kind = event["event"]
            if kind == "on_chain_start" and event.get("name") in _STREAM_NODES:
                yield f"data: {json.dumps({'type':'step','node':event['name']})}\n\n"
            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"].content
                if chunk:
                    yield f"data: {json.dumps({'type':'token','content':chunk})}\n\n"
            if kind == "on_chain_end" and event.get("name") == "LangGraph":
                output = event["data"].get("output", {})
                pending = output.get("pending_action")
                action_id = _maybe_register(pending)
                yield f"data: {json.dumps({'type':'done','route':output.get('route',''),'steps':output.get('agent_steps',[]),'media_result':output.get('media_result'),'action_id':action_id})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
