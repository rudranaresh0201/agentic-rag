from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
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
)

_EXECUTABLE = {"rag", "web", "gmail", "calendar", "media", "github", "system", "social", "email_draft", "email_send", "pr_create", "resume_tailor", "standup", "code_writer"}

# Maps step names to node names (same here, but explicit for clarity)
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
    "synthesis":     "synthesis",
}


def _dispatch(state: AgentState) -> str:
    """Read mcp_plan[plan_index] and return the next node name."""
    plan = state.get("mcp_plan") or ["rag"]
    idx = state.get("plan_index", 0)
    if idx >= len(plan):
        return "synthesis"
    step = plan[idx]
    return step if step in _EXECUTABLE else "synthesis"


def _post_advance(state: AgentState) -> str:
    """After advance_plan_node increments plan_index, decide what comes next."""
    plan = state.get("mcp_plan") or []
    idx = state.get("plan_index", 0)       # already incremented by advance_plan_node
    if idx >= len(plan):
        return "synthesis"
    step = plan[idx]
    return step if step in _EXECUTABLE else "synthesis"


def _guardrail_result(state: AgentState) -> str:
    return "end" if state.get("final_answer") == "I can't help with that." else "orchestrator"


def build_graph():
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
    graph.add_node("github",         github_node)
    graph.add_node("system",         system_node)
    graph.add_node("social",         social_media_node)
    graph.add_node("email_draft",    email_draft_node)
    graph.add_node("email_send",     email_send_node)
    graph.add_node("pr_create",      pr_create_node)
    graph.add_node("resume_tailor",  resume_tailor_node)
    graph.add_node("standup",        standup_node)
    graph.add_node("code_writer",    code_writer_node)
    graph.add_node("synthesis",      synthesis_node)
    graph.add_node("critic",        critic_node)
    graph.add_node("clarify",       clarify_node)

    graph.set_entry_point("guardrail")
    graph.add_conditional_edges("guardrail", _guardrail_result, {"end": END, "orchestrator": "orchestrator"})

    # orchestrator → memory_read → first plan step (or synthesis if plan is empty)
    graph.add_edge("orchestrator", "memory_read")
    graph.add_conditional_edges("memory_read", _dispatch, _DISPATCH_MAP)

    # every agent node funnels through advance_plan before the next routing decision
    for _node in ["rag", "web", "gmail", "calendar", "media", "github", "system", "social", "email_draft", "email_send", "pr_create", "resume_tailor", "standup", "code_writer"]:
        graph.add_edge(_node, "advance_plan")

    # after advancing, loop back to the next step or exit to synthesis
    graph.add_conditional_edges("advance_plan", _post_advance, _DISPATCH_MAP)

    # synthesis → critic → memory_write → END
    graph.add_edge("synthesis",     "critic")
    graph.add_edge("critic",        "memory_write")
    graph.add_edge("memory_write",  END)
    graph.add_edge("clarify",       END)

    return graph.compile(checkpointer=MemorySaver())


agent_graph = build_graph()
