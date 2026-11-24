import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings, UPLOADS_DIR
from app.core.database import init_db
from app.api import auth, documents, chat, dashboard, study, settings as settings_api
from app.rag.vector_store import vector_store, HAS_FAISS
from app.rag.embeddings import HAS_SENTENCE_TRANSFORMERS
from app.rag.extractor import HAS_PYMUPDF, HAS_PYPDF
from app.services.gemini_service import gemini_service

# Initialize database tables on startup
init_db()

app = FastAPI(
    title=f"{settings.app_name} API",
    version=settings.app_version,
    description="StudyMind AI – Production RAG Study Assistant with JWT Auth & SQLite Persistence"
)

# Robust CORS Configuration
raw_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
is_wildcard = "*" in raw_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else raw_origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Production Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Mount uploads directory for PDF viewing
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Register Routers
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(study.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "tagline": settings.tagline,
        "llm_configured": gemini_service.is_configured(),
        "llm_model": settings.gemini_model,
        "vector_store": {
            "type": "FAISS Index" if HAS_FAISS else "Normalized Dense Cosine Index",
            "total_indexed_chunks": vector_store.total_chunks_for_user(),
            "status": "ready"
        },
        "pipeline": {
            "pdf_extractor": "PyMuPDF" if HAS_PYMUPDF else ("pypdf" if HAS_PYPDF else "None"),
            "embeddings": "Sentence Transformers" if HAS_SENTENCE_TRANSFORMERS else "Dense Semantic Vectorizer (384-dim)",
            "vector_store": "FAISS (IndexFlatIP)" if HAS_FAISS else "Cosine Similarity Matrix"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
