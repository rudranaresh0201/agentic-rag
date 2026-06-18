from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP
from ..db import embed_texts, get_collection
from ..retrieval import warmup_bm25_index
from ..utils import chunk_text, clean_text
from ..core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/ingest-url", tags=["url-ingest"])


class UrlIngestRequest(BaseModel):
    url: str


@router.post("")
def ingest_url(req: UrlIngestRequest):
    import requests
    from bs4 import BeautifulSoup

    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {exc}")

    soup = BeautifulSoup(resp.text, "html.parser")

    title = (soup.title.string or "").strip() if soup.title else ""
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    raw_text = soup.get_text(separator=" ", strip=True)
    text = clean_text(raw_text)

    if not text:
        raise HTTPException(status_code=400, detail="No extractable text found at that URL.")

    domain = urlparse(url).netloc
    filename = (f"{domain} - {title}" if title else domain)[:200]
    doc_id = hashlib.sha256(url.encode()).hexdigest()[:16]

    collection = get_collection()
    existing = collection.get(where={"doc_id": doc_id})
    if existing.get("ids"):
        return {
            "doc_id": doc_id,
            "filename": filename,
            "chunks": len(existing["ids"]),
            "status": "already_ingested",
        }

    chunks = chunk_text(text, chunk_size=RAG_CHUNK_SIZE, overlap=RAG_CHUNK_OVERLAP)
    if not chunks:
        raise HTTPException(status_code=400, detail="No valid text chunks produced.")

    embeddings = embed_texts(chunks)
    uploaded_at = datetime.now(timezone.utc).isoformat()
    ids = [f"url-{doc_id}-{uuid.uuid4()}" for _ in chunks]
    metadatas = [
        {
            "file": filename,
            "doc_id": doc_id,
            "size": len(text),
            "uploaded_at": uploaded_at,
            "chunk_index": i,
            "page": 0,
            "s3_key": "",
            "content_hash": "",
            "url_source": "true",
            "url": url,
        }
        for i in range(len(chunks))
    ]
    collection.add(ids=ids, documents=chunks, metadatas=metadatas, embeddings=embeddings)

    try:
        warmup_bm25_index()
    except Exception as exc:
        logger.warning("[URL-INGEST] BM25 warmup failed: %s", exc)

    logger.info("[URL-INGEST] Ingested url=%s doc_id=%s chunks=%d", url, doc_id, len(chunks))
    return {"doc_id": doc_id, "filename": filename, "chunks": len(chunks), "status": "ingested"}


@router.get("/list")
def list_url_documents():
    collection = get_collection()
    data = collection.get(where={"url_source": "true"})
    metadatas = data.get("metadatas") or []
    seen: set[str] = set()
    documents = []
    for meta in metadatas:
        if not isinstance(meta, dict):
            continue
        doc_id = str(meta.get("doc_id", "")).strip()
        if not doc_id or doc_id in seen:
            continue
        seen.add(doc_id)
        documents.append({
            "doc_id": doc_id,
            "filename": meta.get("file", ""),
            "url": meta.get("url", ""),
            "uploaded_at": meta.get("uploaded_at", ""),
        })
    return {"documents": documents}
