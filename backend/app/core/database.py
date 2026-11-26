from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Create engine (Handle SQLite vs PostgreSQL, and fix Render postgres:// schema)
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_sample_users():
    """Idempotently seeds sample accounts shown on the Sign In page if missing."""
    from app.models.db_models import User
    from app.core.security import hash_password

    samples = [
        ("Sample Scholar", "student@studymind.ai", "StudyMind@2025"),
        ("Alex Morgan", "alex@university.edu", "Study@2025"),
    ]
    db = SessionLocal()
    try:
        changed = False
        for full_name, email, plain_pw in samples:
            if not db.query(User).filter(User.email == email).first():
                db.add(User(
                    full_name=full_name,
                    email=email,
                    hashed_password=hash_password(plain_pw),
                ))
                changed = True
        if changed:
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Database] Sample user seed skipped: {e}")
    finally:
        db.close()

def ensure_schema_columns():
    """Safely adds additive columns to existing databases without destroying user data."""
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        if inspector.has_table("chat_messages"):
            cols = {c["name"] for c in inspector.get_columns("chat_messages")}
            if "feedback" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN feedback VARCHAR(20)"))
    except Exception as e:
        print(f"[Database] Additive schema migration check skipped: {e}")


def init_db():
    # Import all models before create_all
    import app.models.db_models
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns()
    seed_sample_users()
