from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.db_models import User, Document, ChatConversation, ChatMessage
from app.models.schemas import DashboardStatsResponse, DocumentResponse, ConversationSummary
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns real metrics and stats from the persistent database
    isolated for the authenticated user.
    """
    # 1. Total documents and chunks
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    total_docs = len(docs)
    total_chunks = sum(d.total_chunks for d in docs)

    # 2. Total questions (role == 'user' across user's conversations)
    total_questions = db.query(ChatMessage).join(
        ChatConversation, ChatMessage.conversation_id == ChatConversation.id
    ).filter(
        ChatConversation.user_id == current_user.id,
        ChatMessage.role == "user"
    ).count()

    # 3. Conversations
    conversations = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()
    total_conversations = len(conversations)

    # 4. Recent documents (last 4)
    recent_docs = sorted(docs, key=lambda x: x.upload_date, reverse=True)[:4]

    # 5. Recent conversation summaries (last 4)
    recent_conv_summaries = []
    for c in conversations[:4]:
        recent_conv_summaries.append(
            ConversationSummary(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=len(c.messages)
            )
        )

    return DashboardStatsResponse(
        total_documents=total_docs,
        total_chunks=total_chunks,
        total_questions=total_questions,
        total_conversations=total_conversations,
        recent_documents=[DocumentResponse.model_validate(d) for d in recent_docs],
        recent_conversations=recent_conv_summaries,
        llm_configured=gemini_service.is_configured(),
        llm_model=settings.gemini_model
    )
