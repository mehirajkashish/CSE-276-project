from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.db_models import User
from app.models.schemas import (
    StudySummaryRequest, FlashcardResponse,
    QuizResponse, ExplainSimplyRequest, RevisionNotesResponse,
    ImportantTopicsResponse
)
from app.services.study_service import study_service

router = APIRouter(prefix="/study", tags=["Study Tools"])

@router.post("/summary")
def generate_summary(
    req: StudySummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return study_service.generate_summary(
            db, current_user.id, req.document_id, req.style or "detailed",
            focus=req.focus, model=req.model,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/flashcards", response_model=FlashcardResponse)
def generate_flashcards(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    count = int(data.get("count", 6) or 6)
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_flashcards(
            db, current_user.id, doc_id, count,
            focus=data.get("focus"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/quiz", response_model=QuizResponse)
def generate_quiz(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    count = int(data.get("count", 5) or 5)
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_quiz(
            db, current_user.id, doc_id, count,
            focus=data.get("focus"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/explain-simply")
def explain_simply(
    req: ExplainSimplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return study_service.explain_simply(
            db, current_user.id, req.topic, req.document_id, model=req.model,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/revision-notes", response_model=RevisionNotesResponse)
def revision_notes(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_revision_notes(
            db, current_user.id, doc_id,
            focus=data.get("focus"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/important-topics", response_model=ImportantTopicsResponse)
def important_topics(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_important_topics(
            db, current_user.id, doc_id, model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ai-notes")
def generate_ai_notes(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_ai_notes(
            db, current_user.id, doc_id, data.get("depth", "comprehensive"),
            focus=data.get("focus"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/mind-map")
def generate_mind_map(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_mind_map(
            db, current_user.id, doc_id, model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/practice-questions")
def generate_practice_questions(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    count = int(data.get("count", 5) or 5)
    try:
        return study_service.generate_practice_questions(
            db, current_user.id, doc_id, count,
            focus=data.get("focus"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/coding-tutor")
def coding_tutor(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    topic = (data.get("topic") or "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required.")
    lang = data.get("language", "python")
    try:
        return study_service.generate_coding_tutor(
            db, current_user.id, topic, lang,
            document_id=data.get("document_id"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/question-paper")
def generate_question_paper(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required.")
    try:
        return study_service.generate_question_paper(
            db, current_user.id, doc_id,
            focus=data.get("focus"), model=data.get("model"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
