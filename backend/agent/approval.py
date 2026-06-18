from langgraph.types import interrupt


def request_approval(action_type: str, payload: dict, preview: str) -> dict:
    return interrupt({"type": action_type, "payload": payload, "preview": preview})
