import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import dotenv_values

# Base Directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
VECTOR_STORE_DIR = DATA_DIR / "vector_store"
SETTINGS_FILE = DATA_DIR / "settings.json"
ENV_FILE = BASE_DIR / ".env"
ROOT_ENV_FILE = BASE_DIR.parent / ".env"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)


def _read_merged_env() -> dict[str, str]:
    """Read non-empty values from root .env (fallback) and backend/.env (authoritative)."""
    merged: dict[str, str] = {}
    for env_path in (ROOT_ENV_FILE, ENV_FILE):
        if env_path.exists():
            for key, val in dotenv_values(env_path).items():
                if val is not None and val.strip():
                    merged[key] = val.strip()
    return merged


# Populate unset OS env vars without letting empty placeholders overwrite real values
for _k, _v in _read_merged_env().items():
    if not os.environ.get(_k):
        os.environ[_k] = _v

DB_PATH = (DATA_DIR / "studymind.db").resolve().as_posix()


def _resolve_database_url(raw_url: str) -> str:
    """Resolve relative sqlite:///./... URLs against BASE_DIR (backend/) regardless of cwd."""
    if raw_url.startswith("sqlite:///./"):
        rel = raw_url[len("sqlite:///./"):]
        return f"sqlite:///{(BASE_DIR / rel).resolve().as_posix()}"
    return raw_url


class Settings(BaseModel):
    app_name: str = "StudyMind AI"
    app_version: str = "2.0.0"
    tagline: str = "Your Knowledge. Your AI. Your Success."
    database_url: str = _resolve_database_url(os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}"))
    jwt_secret: str = os.getenv("JWT_SECRET", "studymind_super_secret_jwt_key_2026_academic_rag")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1")
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    serper_api_key: str = os.getenv("SERPER_API_KEY", "")
    enable_web_search: bool = os.getenv("ENABLE_WEB_SEARCH", "true").lower() in ("1", "true", "yes")
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("SMTP_FROM", "")
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
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
    merged = _read_merged_env()
    for key, val in merged.items():
        os.environ[key] = val
    settings.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    settings.gemini_model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
    settings.openai_api_key = os.getenv("OPENAI_API_KEY", "")
    settings.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    settings.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    settings.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "")
    settings.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1")
    settings.tavily_api_key = os.getenv("TAVILY_API_KEY", "")
    settings.serper_api_key = os.getenv("SERPER_API_KEY", "")
    settings.smtp_host = os.getenv("SMTP_HOST", "")
    settings.smtp_port = int(os.getenv("SMTP_PORT", "587"))
    settings.smtp_user = os.getenv("SMTP_USER", "")
    settings.smtp_password = os.getenv("SMTP_PASSWORD", "")
    settings.smtp_from = os.getenv("SMTP_FROM", "")
    settings.resend_api_key = os.getenv("RESEND_API_KEY", "")
    return settings
