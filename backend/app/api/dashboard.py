import json
from datetime import datetime, timedelta, timezone, date
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.db_models import User, Document, ChatConversation, ChatMessage, StudyActivity
from app.models.schemas import (
    DashboardStatsResponse,
    DocumentResponse,
    ConversationSummary,
    StudyActivityCreate,
)
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _to_utc_date(dt: Optional[datetime]) -> Optional[date]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(timezone.utc).date()


def _to_utc_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns real metrics and stats from the persistent database isolated for the authenticated user."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    total_docs = len(docs)
    total_chunks = sum(d.total_chunks for d in docs)

    total_questions = db.query(ChatMessage).join(
        ChatConversation, ChatMessage.conversation_id == ChatConversation.id
    ).filter(
        ChatConversation.user_id == current_user.id,
        ChatMessage.role == "user"
    ).count()

    conversations = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()
    total_conversations = len(conversations)

    recent_docs = sorted(docs, key=lambda x: x.upload_date, reverse=True)[:4]
    recent_conv_summaries = [
        ConversationSummary(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        )
        for c in conversations[:4]
    ]

    return DashboardStatsResponse(
        total_documents=total_docs,
        total_chunks=total_chunks,
        total_questions=total_questions,
        total_conversations=total_conversations,
        recent_documents=[DocumentResponse.model_validate(d) for d in recent_docs],
        recent_conversations=recent_conv_summaries,
        llm_configured=gemini_service.is_configured(),
        llm_model=settings.gemini_model,
    )


@router.post("/activity")
def log_study_activity(
    payload: StudyActivityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persists real quiz, flashcard, focus timer, and study tool sessions for the user."""
    allowed = {"quiz", "flashcard", "focus", "study_tool"}
    act_type = (payload.activity_type or "").strip().lower()
    if act_type not in allowed:
        act_type = "study_tool"

    subject = (payload.subject or "").strip() or None
    if not subject and payload.document_id:
        doc = db.query(Document).filter(
            Document.id == payload.document_id,
            Document.user_id == current_user.id,
        ).first()
        if doc:
            subject = doc.filename

    entry = StudyActivity(
        user_id=current_user.id,
        document_id=payload.document_id,
        subject=subject,
        activity_type=act_type,
        score=max(0, int(payload.score or 0)),
        total=max(0, int(payload.total or 0)),
        duration_seconds=max(0, int(payload.duration_seconds or 0)),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"status": "logged", "id": entry.id}


@router.get("/analytics")
def get_learning_analytics(
    period: str = Query("7d", pattern="^(7d|30d|all)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Computes 100% real, database-backed learning analytics isolated per user:
    - Study streak (consecutive active days across chats, uploads, and study activities)
    - Documents & chunks indexed
    - Real chat questions + quiz/flashcard questions solved & accuracy %
    - Real focus hours & daily activity series
    - Subject-wise mastery & engagement derived from user's documents & assessments
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    if period == "7d":
        cutoff = now - timedelta(days=6)
        bucket_days = 7
    elif period == "30d":
        cutoff = now - timedelta(days=29)
        bucket_days = 30
    else:
        cutoff = None
        bucket_days = 7

    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    user_msgs = (
        db.query(ChatMessage)
        .join(ChatConversation, ChatMessage.conversation_id == ChatConversation.id)
        .filter(ChatConversation.user_id == current_user.id, ChatMessage.role == "user")
        .all()
    )
    asst_msgs = (
        db.query(ChatMessage)
        .join(ChatConversation, ChatMessage.conversation_id == ChatConversation.id)
        .filter(ChatConversation.user_id == current_user.id, ChatMessage.role == "assistant")
        .all()
    )
    activities = (
        db.query(StudyActivity)
        .filter(StudyActivity.user_id == current_user.id)
        .all()
    )

    # Active dates across all signals for real consecutive streak
    active_dates = set()
    for d in docs:
        dt = _to_utc_date(d.upload_date)
        if dt:
            active_dates.add(dt)
    for m in user_msgs:
        dt = _to_utc_date(m.timestamp)
        if dt:
            active_dates.add(dt)
    for a in activities:
        dt = _to_utc_date(a.created_at)
        if dt:
            active_dates.add(dt)

    # Consecutive streak ending today or yesterday
    streak = 0
    cursor = today if today in active_dates else (today - timedelta(days=1))
    while cursor in active_dates:
        streak += 1
        cursor -= timedelta(days=1)

    this_week_active = sum(1 for k in range(7) if (today - timedelta(days=k)) in active_dates)
    prev_week_active = sum(1 for k in range(7, 14) if (today - timedelta(days=k)) in active_dates)
    streak_delta = this_week_active - prev_week_active

    # Period filtering
    def _in_period(dt: Optional[datetime]) -> bool:
        if cutoff is None:
            return True
        u = _to_utc_dt(dt)
        return u is not None and u >= cutoff.replace(hour=0, minute=0, second=0, microsecond=0)

    period_msgs = [m for m in user_msgs if _in_period(m.timestamp)]
    period_acts = [a for a in activities if _in_period(a.created_at)]

    # Questions solved & MCQ/flashcard accuracy
    assessed_acts = [a for a in period_acts if a.activity_type in ("quiz", "flashcard") and a.total > 0]
    assessed_score = sum(a.score for a in assessed_acts)
    assessed_total = sum(a.total for a in assessed_acts)
    mcq_accuracy_pct: Optional[int] = (
        round((assessed_score / assessed_total) * 100) if assessed_total > 0 else None
    )

    quiz_questions_solved = sum(a.total for a in assessed_acts)
    total_questions_solved = len(period_msgs) + quiz_questions_solved

    # Real focus seconds (strictly recorded focus + study sessions; 0 if none recorded yet)
    focus_acts = [a for a in period_acts if a.activity_type == "focus"]
    total_focus_seconds = sum(a.duration_seconds for a in period_acts if a.duration_seconds > 0)
    focus_hours = round(total_focus_seconds / 3600.0, 1)
    span_days = max(1, len({d for d in active_dates if cutoff is None or d >= cutoff.date()}))
    daily_avg_hours = round(focus_hours / span_days, 1) if total_focus_seconds > 0 else 0.0

    # Activity chart buckets
    if period == "30d":
        # 6 five-day buckets so mobile & desktop charts stay legible
        buckets = []
        for idx in range(6):
            end_d = today - timedelta(days=(5 - idx) * 5)
            start_d = end_d - timedelta(days=4)
            b_secs = sum(
                a.duration_seconds
                for a in period_acts
                if (_to_utc_date(a.created_at) is not None and start_d <= _to_utc_date(a.created_at) <= end_d)
            )
            b_queries = sum(
                1 for m in period_msgs
                if (_to_utc_date(m.timestamp) is not None and start_d <= _to_utc_date(m.timestamp) <= end_d)
            ) + sum(
                max(1, a.total) for a in period_acts
                if (_to_utc_date(a.created_at) is not None and start_d <= _to_utc_date(a.created_at) <= end_d)
            )
            buckets.append({
                "day": start_d.strftime("%b %d"),
                "hours": round(b_secs / 3600.0, 2),
                "queries": b_queries,
            })
    else:
        # 7d or All Time (recent 7 active/calendar days)
        buckets = []
        for offset in range(6, -1, -1):
            d_day = today - timedelta(days=offset)
            b_secs = sum(
                a.duration_seconds for a in period_acts if _to_utc_date(a.created_at) == d_day
            )
            b_queries = sum(
                1 for m in period_msgs if _to_utc_date(m.timestamp) == d_day
            ) + sum(
                max(1, a.total) for a in period_acts if _to_utc_date(a.created_at) == d_day
            )
            buckets.append({
                "day": d_day.strftime("%a"),
                "date": d_day.isoformat(),
                "hours": round(b_secs / 3600.0, 2),
                "queries": b_queries,
            })

    # Count document citations across assistant chats to measure real study engagement per PDF
    doc_citations: Dict[str, int] = {}
    for am in asst_msgs:
        if not am.source_metadata:
            continue
        try:
            srcs = json.loads(am.source_metadata)
            if isinstance(srcs, list):
                for s in srcs:
                    did = s.get("document_id")
                    if did:
                        doc_citations[did] = doc_citations.get(did, 0) + 1
        except Exception:
            pass

    # Subject performance derived from real Documents + StudyActivity rows
    subject_map: Dict[str, Dict] = {}
    for doc in docs:
        subject_map[doc.id] = {
            "subject": doc.filename,
            "document_id": doc.id,
            "score": 0,
            "total": 0,
            "tool_runs": 0,
            "chat_citations": doc_citations.get(doc.id, 0),
        }

    for act in period_acts:
        if act.activity_type == "focus" and not act.document_id:
            continue
        key = act.document_id or (act.subject or "General Study")
        if key not in subject_map:
            subject_map[key] = {
                "subject": act.subject or "General Study",
                "document_id": act.document_id,
                "score": 0,
                "total": 0,
                "tool_runs": 0,
                "chat_citations": doc_citations.get(act.document_id or "", 0),
            }
        if act.activity_type in ("quiz", "flashcard") and act.total > 0:
            subject_map[key]["score"] += act.score
            subject_map[key]["total"] += act.total
        else:
            subject_map[key]["tool_runs"] += 1

    subject_performance = []
    for entry in subject_map.values():
        if entry["total"] > 0:
            acc = round((entry["score"] / entry["total"]) * 100)
            status = "Mastered" if acc >= 85 else ("Proficient" if acc >= 65 else "Review Needed")
            subject_performance.append({
                "subject": entry["subject"],
                "document_id": entry["document_id"],
                "accuracy": acc,
                "assessed_count": entry["total"],
                "chat_citations": entry["chat_citations"],
                "tool_runs": entry["tool_runs"],
                "status": status,
                "has_quiz_data": True,
            })
        else:
            # Show real document study engagement instead of fake %
            interactions = entry["chat_citations"] + entry["tool_runs"]
            subject_performance.append({
                "subject": entry["subject"],
                "document_id": entry["document_id"],
                "accuracy": None,
                "assessed_count": 0,
                "chat_citations": entry["chat_citations"],
                "tool_runs": entry["tool_runs"],
                "status": f"{interactions} AI interaction{'s' if interactions != 1 else ''}" if interactions > 0 else "Not Quizzed Yet",
                "has_quiz_data": False,
            })

    return {
        "period": period,
        "study_streak_days": streak,
        "active_days_this_week": this_week_active,
        "streak_delta": streak_delta,
        "total_documents": len(docs),
        "total_chunks": sum(d.total_chunks for d in docs),
        "total_questions_solved": total_questions_solved,
        "chat_questions_count": len(period_msgs),
        "quiz_questions_count": quiz_questions_solved,
        "mcq_accuracy_pct": mcq_accuracy_pct,
        "focus_hours": focus_hours,
        "focus_sessions_count": len(focus_acts),
        "daily_avg_hours": daily_avg_hours,
        "weekly_activity": buckets,
        "subject_performance": subject_performance,
    }
