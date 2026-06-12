from fastapi import APIRouter, HTTPException
from backend.memory.episodic_store import list_memories, delete_memory

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/list")
def get_memories():
    return {"memories": list_memories()}


@router.delete("/{memory_id}")
def remove_memory(memory_id: int):
    if not delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": memory_id}
