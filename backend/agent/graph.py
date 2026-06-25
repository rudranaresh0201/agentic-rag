from langgraph.graph import StateGraph, END
from backend.agent.state import AgentState
from backend.agent.nodes import (
    guardrail_node,
    orchestrator_node,
    advance_plan_node,
    memory_node,
    rag_node,
    web_node,
    synthesis_node,
    critic_node,
    clarify_node,
    gmail_node,
    calendar_node,
    media_node,
    github_node,
    system_node,
    social_media_node,
    email_draft_node,
    email_send_node,
    pr_create_node,
    resume_tailor_node,
    standup_node,
    code_writer_node,
    code_commit_node,
    diff_preview_node,
    data_analyst_node,
)

_EXECUTABLE = {"rag", "web", "gmail", "calendar", "media", "github", "system", "social", "email_draft", "email_send", "pr_create", "resume_tailor", "standup", "code_writer", "data_analyst"}

_DISPATCH_MAP = {
    "rag":           "rag",
    "web":           "web",
    "gmail":         "gmail",
    "calendar":      "calendar",
    "media":         "media",
    "github":        "github",
    "system":        "system",
    "social":        "social",
    "email_draft":   "email_draft",
    "email_send":    "email_send",
    "pr_create":     "pr_create",
    "resume_tailor": "resume_tailor",
    "standup":       "standup",
    "code_writer":   "code_writer",
    "data_analyst":  "data_analyst",
    "synthesis":     "synthesis",
}


def _dispatch(state: AgentState) -> str:
    plan = state.get("mcp_plan") or []
    idx = state.get("plan_index", 0)
    if idx >= len(plan):
        return "synthesis"
    step = plan[idx]
    return step if step in _EXECUTABLE else "synthesis"


def _post_advance(state: AgentState) -> str:
    plan = state.get("mcp_plan") or []
    idx = state.get("plan_index", 0)
    if idx >= len(plan):
        return "synthesis"
    step = plan[idx]
    return step if step in _EXECUTABLE else "synthesis"


def _guardrail_result(state: AgentState) -> str:
    return "end" if state.get("final_answer") == "I can't help with that." else "orchestrator"


def _after_code_writer(state: AgentState) -> str:
    if state.get("pr_after_code"):
        dest = "code_commit"
    elif state.get("execute_after_code"):
        dest = "advance_plan"  # already executed — skip commit approval, go straight to synthesis
    else:
        dest = "diff_preview"
    print(f"[TRACE-6] _after_code_writer: pr_after_code={state.get('pr_after_code')} execute_after_code={state.get('execute_after_code')} -> routing to '{dest}'")
    return dest


def _build_uncompiled() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("guardrail",     guardrail_node)
    graph.add_node("orchestrator",  orchestrator_node)
    graph.add_node("memory_read",   memory_node)
    graph.add_node("memory_write",  memory_node)
    graph.add_node("advance_plan",  advance_plan_node)
    graph.add_node("rag",           rag_node)
    graph.add_node("web",           web_node)
    graph.add_node("gmail",         gmail_node)
    graph.add_node("calendar",      calendar_node)
    graph.add_node("media",         media_node)
    graph.add_node("github",        github_node)
    graph.add_node("system",        system_node)
    graph.add_node("social",        social_media_node)
    graph.add_node("email_draft",   email_draft_node)
    graph.add_node("email_send",    email_send_node)
    graph.add_node("pr_create",     pr_create_node)
    graph.add_node("resume_tailor", resume_tailor_node)
    graph.add_node("standup",       standup_node)
    graph.add_node("code_writer",   code_writer_node)
    graph.add_node("code_commit",   code_commit_node)
    graph.add_node("diff_preview",  diff_preview_node)
    graph.add_node("data_analyst",  data_analyst_node)
    graph.add_node("synthesis",     synthesis_node)
    graph.add_node("critic",        critic_node)
    graph.add_node("clarify",       clarify_node)

    graph.set_entry_point("guardrail")
    graph.add_conditional_edges("guardrail", _guardrail_result, {"end": END, "orchestrator": "orchestrator"})

    graph.add_edge("orchestrator", "memory_read")
    graph.add_conditional_edges("memory_read", _dispatch, _DISPATCH_MAP)

    graph.add_conditional_edges("code_writer", _after_code_writer, {"code_commit": "code_commit", "diff_preview": "diff_preview", "advance_plan": "advance_plan"})
    graph.add_edge("code_commit",  "advance_plan")
    graph.add_edge("diff_preview", "advance_plan")

    for _node in ["rag", "web", "gmail", "calendar", "media", "github", "system", "social",
                  "email_draft", "email_send", "pr_create", "resume_tailor", "standup", "data_analyst"]:
        graph.add_edge(_node, "advance_plan")

    graph.add_conditional_edges("advance_plan", _post_advance, _DISPATCH_MAP)

    graph.add_edge("synthesis",    "critic")
    graph.add_edge("critic",       "memory_write")
    graph.add_edge("memory_write", END)
    graph.add_edge("clarify",      END)

    return graph


# Set at startup via init_agent_graph(); routes use get_agent_graph()
_agent_graph = None


def get_agent_graph():
    return _agent_graph


async def init_agent_graph():
    global _agent_graph
    from pathlib import Path
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
    import aiosqlite

    db_path = Path(__file__).resolve().parent.parent / "checkpoints.db"
    conn = await aiosqlite.connect(str(db_path))
    checkpointer = AsyncSqliteSaver(conn)
    _agent_graph = _build_uncompiled().compile(checkpointer=checkpointer)


# Legacy alias — will be None until startup; kept so any stale imports don't crash at import time
agent_graph = None
