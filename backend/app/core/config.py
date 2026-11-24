import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Base Directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
VECTOR_STORE_DIR = DATA_DIR / "vector_store"
SETTINGS_FILE = DATA_DIR / "settings.json"
ENV_FILE = BASE_DIR / ".env"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)

# Load environment variables
load_dotenv(ENV_FILE)

DB_PATH = (DATA_DIR / "studymind.db").resolve().as_posix()

class Settings(BaseModel):
    app_name: str = "StudyMind AI"
    app_version: str = "2.0.0"
    tagline: str = "Your Knowledge. Your AI. Your Success."
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")
    jwt_secret: str = os.getenv("JWT_SECRET", "studymind_super_secret_jwt_key_2026_academic_rag")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "750"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "150"))
    top_k: int = int(os.getenv("TOP_K", "4"))
    similarity_threshold: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.15"))
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "hybrid-semantic")
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:3000,http://localhost:80,http://127.0.0.1:80"
    )

settings = Settings()

def reload_settings():
    global settings
    load_dotenv(ENV_FILE, override=True)
    settings.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    settings.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return settings
