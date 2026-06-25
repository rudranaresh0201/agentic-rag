from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import uuid
from langgraph.types import Command
from backend.agent.graph import get_agent_graph
from backend.agent.state import AgentState
from backend.api.routes_actions import register_action
from backend.auth.jwt_utils import get_current_user
from backend.db.models import User

router = APIRouter(prefix="/agent", tags=["agent"])

class AgentRequest(BaseModel):
    query: str
    thread_id: str | None = None

class ResumeRequest(BaseModel):
    thread_id: str
    approved: bool
    edited_payload: dict | None = None

_EMPTY_STATE_BASE = {
    "messages": [],
    "route": "rag",
    "rag_results": [],
    "web_results": [],
    "gmail_results": [],
    "calendar_results": [],
    "github_results": [],
    "system_result": None,
    "pending_action": None,
    "mcp_plan": [],
    "plan_index": 0,
    "media_result": None,
    "memory_context": [],
    "final_answer": "",
    "agent_steps": [],
    "social_post": None,
    "email_draft": None,
    "resume_result": None,
    "standup_result": None,
    "data_result": None,
    "user_id": None,
}


def _initial_state(query: str, user_id: str | None = None) -> AgentState:
    return {**_EMPTY_STATE_BASE, "query": query, "user_id": user_id}  # type: ignore[return-value]


def _maybe_register(pending: dict | None) -> str | None:
    """If the agent produced a pending action, deposit it in the actions store."""
    if pending and pending.get("type"):
        return register_action(
            action_type=pending["type"],
            payload=pending.get("payload", {}),
            preview=pending.get("preview", ""),
        )
    return None


def _build_normal_response(result: dict, thread_id: str) -> dict:
    pending = result.get("pending_action")
    action_id = _maybe_register(pending)

    # When a pending action was created, return awaiting_approval so the frontend
    # shows an inline ApprovalCard (not the floating ActionConfirmModal).
    # This also prevents setQueryCount from incrementing, which would otherwise
    # trigger ActionConfirmModal's useEffect and cause a phantom confirm call.
    if pending and action_id:
        return {
            "status": "awaiting_approval",
            "thread_id": thread_id,
            "interrupt_data": {
                "type": pending.get("type"),
                "payload": pending.get("payload", {}),
                "preview": pending.get("preview", ""),
                "action_id": action_id,  # discriminator: ApprovalCard uses confirmAction not resumeAgent
            },
        }

    return {
        "status": "complete",
        "thread_id": thread_id,
        "answer": result["final_answer"],
        "route": result["route"],
        "steps": result["agent_steps"],
        "rag_sources": [r.get("filename") or r.get("source") for r in result.get("rag_results", [])],
        "web_sources": [r.get("source") for r in result.get("web_results", [])],
        "media_result": result.get("media_result"),
        "gmail_results": result.get("gmail_results", []),
        "calendar_results": result.get("calendar_results", []),
        "github_results": result.get("github_results", []),
        "system_result": result.get("system_result"),
        "pending_action": pending,
        "action_id": action_id,
        "mcp_plan": result.get("mcp_plan", []),
        "social_post": result.get("social_post"),
        "email_draft": result.get("email_draft"),
        "resume_result": result.get("resume_result"),
        "standup_result": result.get("standup_result"),
        "code_result": result.get("code_result"),
        "execution_result": result.get("execution_result"),
        "data_result": result.get("data_result"),
    }


@router.post("/query")
async def agent_query(req: AgentRequest, current_user: User = Depends(get_current_user)):
    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    result = await get_agent_graph().ainvoke(_initial_state(req.query, user_id=str(current_user.id)), config=config)
    print(f"[agent_query] result keys: {list(result.keys())}, has_interrupt: {'__interrupt__' in result}, thread_id: {thread_id}")

    if "__interrupt__" in result:
        interrupt_data = result["__interrupt__"]
        # interrupt() returns a tuple of Interrupt objects; grab the value from the first
        payload = interrupt_data[0].value if hasattr(interrupt_data[0], "value") else interrupt_data
        return {
            "status": "awaiting_approval",
            "thread_id": thread_id,
            "interrupt_data": payload,
        }

    return _build_normal_response(result, thread_id)


@router.post("/resume")
async def agent_resume(req: ResumeRequest, current_user: User = Depends(get_current_user)):
    config = {"configurable": {"thread_id": req.thread_id}}
    result = await get_agent_graph().ainvoke(
        Command(resume={"approved": req.approved, "payload": req.edited_payload}),
        config=config,
    )

    if "__interrupt__" in result:
        interrupt_data = result["__interrupt__"]
        payload = interrupt_data[0].value if hasattr(interrupt_data[0], "value") else interrupt_data
        return {
            "status": "awaiting_approval",
            "thread_id": req.thread_id,
            "interrupt_data": payload,
        }

    return _build_normal_response(result, req.thread_id)


@router.post("/query/stream")
async def agent_query_stream(req: AgentRequest, current_user: User = Depends(get_current_user)):
    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    _STREAM_NODES = {"router", "rag", "web", "gmail", "calendar", "media", "synthesis", "clarify"}

    async def event_generator():
        async for event in get_agent_graph().astream_events(_initial_state(req.query, user_id=str(current_user.id)), config=config, version="v2"):
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
                yield f"data: {json.dumps({'type':'done','thread_id':thread_id,'route':output.get('route',''),'steps':output.get('agent_steps',[]),'media_result':output.get('media_result'),'action_id':action_id})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
