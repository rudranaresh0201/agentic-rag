from __future__ import annotations

from typing import Annotated, Literal, Optional, TypedDict
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]   # full conversation history
    query: str                                 # original user query
    route: Literal["rag", "web", "both", "gmail", "calendar", "media", "unclear"]
    rag_results: list[dict]                    # chunks from RAG pipeline
    web_results: list[dict]                    # Tavily search results
    gmail_results: list[dict]                  # fetched email records
    calendar_results: list[dict]               # fetched calendar events
    pending_action: Optional[dict]             # unconfirmed write action (send_email / create_event)
    mcp_plan: list[str]                        # orchestrator's planned agent sequence
    plan_index: int                            # current position in mcp_plan
    media_result: Optional[dict]               # {type, video_id, title, thumbnail} from media_node
    memory_context: list[dict]                 # relevant memories retrieved before synthesis
    final_answer: str                          # synthesis output
    agent_steps: list[str]                     # live steps for SSE streaming
