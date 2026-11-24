import os
from fastapi import APIRouter
from app.core.config import settings, reload_settings, ENV_FILE
from app.models.schemas import SettingsUpdate
from app.rag.embeddings import HAS_SENTENCE_TRANSFORMERS
from app.rag.vector_store import HAS_FAISS, vector_store
from app.rag.extractor import HAS_PYMUPDF, HAS_PYPDF

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("")
def get_current_settings():
    return {
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "tagline": settings.tagline,
        "gemini_api_key_configured": bool(settings.gemini_api_key and settings.gemini_api_key.strip()),
        "gemini_api_key_masked": f"...{settings.gemini_api_key[-4:]}" if len(settings.gemini_api_key) > 6 else ("Configured" if settings.gemini_api_key else "Not set"),
        "gemini_model": settings.gemini_model,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "top_k": settings.top_k,
        "similarity_threshold": settings.similarity_threshold,
        "embedding_model": settings.embedding_model,
        "system_features": {
            "faiss_enabled": HAS_FAISS,
            "sentence_transformers_enabled": HAS_SENTENCE_TRANSFORMERS,
            "pymupdf_enabled": HAS_PYMUPDF,
            "pypdf_enabled": HAS_PYPDF,
            "total_indexed_chunks": vector_store.total_chunks()
        }
    }

@router.post("")
def update_settings(update: SettingsUpdate):
    # Update in-memory and write to .env
    if update.gemini_api_key is not None:
        settings.gemini_api_key = update.gemini_api_key.strip()
    if update.gemini_model is not None:
        settings.gemini_model = update.gemini_model.strip()
    if update.chunk_size is not None:
        settings.chunk_size = update.chunk_size
    if update.chunk_overlap is not None:
        settings.chunk_overlap = update.chunk_overlap
    if update.top_k is not None:
        settings.top_k = update.top_k
    if update.similarity_threshold is not None:
        settings.similarity_threshold = update.similarity_threshold

    # Write to .env file
    try:
        env_lines = []
        if ENV_FILE.exists():
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                env_lines = f.readlines()

        keys_written = set()
        new_lines = []
        for line in env_lines:
            if line.startswith("GEMINI_API_KEY="):
                new_lines.append(f"GEMINI_API_KEY={settings.gemini_api_key}\n")
                keys_written.add("GEMINI_API_KEY")
            elif line.startswith("GEMINI_MODEL="):
                new_lines.append(f"GEMINI_MODEL={settings.gemini_model}\n")
                keys_written.add("GEMINI_MODEL")
            elif line.startswith("CHUNK_SIZE="):
                new_lines.append(f"CHUNK_SIZE={settings.chunk_size}\n")
                keys_written.add("CHUNK_SIZE")
            elif line.startswith("CHUNK_OVERLAP="):
                new_lines.append(f"CHUNK_OVERLAP={settings.chunk_overlap}\n")
                keys_written.add("CHUNK_OVERLAP")
            elif line.startswith("TOP_K="):
                new_lines.append(f"TOP_K={settings.top_k}\n")
                keys_written.add("TOP_K")
            else:
                new_lines.append(line)

        if "GEMINI_API_KEY" not in keys_written:
            new_lines.append(f"GEMINI_API_KEY={settings.gemini_api_key}\n")
        if "GEMINI_MODEL" not in keys_written:
            new_lines.append(f"GEMINI_MODEL={settings.gemini_model}\n")

        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        print(f"[Settings] Error writing to .env: {e}")

    return {
        "success": True,
        "message": "Settings updated successfully."
    }
