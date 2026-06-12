from langgraph.graph import StateGraph, END
from backend.agent.state import AgentState
from backend.agent.nodes import (
    orchestrator_node,
    advance_plan_node,
    memory_node,
    rag_node,
    web_node,
    synthesis_node,
    clarify_node,
    gmail_node,
    calendar_node,
    media_node,
)

_EXECUTABLE = {"rag", "web", "gmail", "calendar", "media"}

# Maps step names to node names (same here, but explicit for clarity)
_DISPATCH_MAP = {
    "rag":      "rag",
    "web":      "web",
    "gmail":    "gmail",
    "calendar": "calendar",
    "media":    "media",
    "synthesis": "synthesis",
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


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("orchestrator",  orchestrator_node)
    graph.add_node("memory_read",   memory_node)
    graph.add_node("memory_write",  memory_node)
    graph.add_node("advance_plan",  advance_plan_node)
    graph.add_node("rag",           rag_node)
    graph.add_node("web",           web_node)
    graph.add_node("gmail",         gmail_node)
    graph.add_node("calendar",      calendar_node)
    graph.add_node("media",         media_node)
    graph.add_node("synthesis",     synthesis_node)
    graph.add_node("clarify",       clarify_node)

    graph.set_entry_point("orchestrator")

    # orchestrator → memory_read → first plan step (or synthesis if plan is empty)
    graph.add_edge("orchestrator", "memory_read")
    graph.add_conditional_edges("memory_read", _dispatch, _DISPATCH_MAP)

    # every agent node funnels through advance_plan before the next routing decision
    for _node in ["rag", "web", "gmail", "calendar", "media"]:
        graph.add_edge(_node, "advance_plan")

    # after advancing, loop back to the next step or exit to synthesis
    graph.add_conditional_edges("advance_plan", _post_advance, _DISPATCH_MAP)

    # synthesis → memory_write → END (stores facts from the answer)
    graph.add_edge("synthesis",     "memory_write")
    graph.add_edge("memory_write",  END)
    graph.add_edge("clarify",       END)

    return graph.compile()


agent_graph = build_graph()
