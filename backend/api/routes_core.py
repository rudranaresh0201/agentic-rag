from __future__ import annotations

from fastapi import APIRouter, Depends

from ..db import get_collection, reset_database
from ..rebuild import is_rebuilding, is_rebuild_locked
from ..auth.jwt_utils import get_current_user
from ..db.models import User

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/stats")
def stats(current_user: User = Depends(get_current_user)):
    collection = get_collection(str(current_user.id))
    return {"total_chunks": collection.count()}


@router.post("/reset")
def reset_db(current_user: User = Depends(get_current_user)):
    reset_database(str(current_user.id))
    return {"message": "Database reset successfully."}


@router.post("/rebuild")
def trigger_rebuild(current_user: User = Depends(get_current_user)):
    from ..services.rebuild_service import rebuild_from_r2_if_empty
    rebuild_from_r2_if_empty(str(current_user.id))
    return {"message": "Rebuild triggered for your collection."}


@router.get("/rebuild/status")
def rebuild_status():
    return {
        "rebuilding": is_rebuilding(),
        "locked": is_rebuild_locked(),
    }
