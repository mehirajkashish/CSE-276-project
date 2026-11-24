import time
import json
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.db_models import User, Document, ChatConversation, ChatMessage
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    SourceCitation,
    ConversationSummary,
    ConversationDetail,
    MessageResponse
)
from app.rag.embeddings import embedding_service
from app.rag.vector_store import vector_store
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
def chat_with_rag(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    RAG Chat Assistant Endpoint:
    1. Validates user input and user-isolated conversation session.
    2. Checks for conversational greetings.
    3. Retrieves top-k matching chunks from the user's uploaded documents.
    4. Generates grounded answer with source citations.
    5. Persists conversation and messages to SQLite database.
    """
    start_time = time.time()
    clean_question = request.question.strip()
    if not clean_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty."
        )

    # 1. Resolve or create Chat Conversation
    conversation = None
    if request.conversation_id:
        conversation = db.query(ChatConversation).filter(
            ChatConversation.id == request.conversation_id,
            ChatConversation.user_id == current_user.id
        ).first()

    if not conversation:
        # Generate friendly title from first 6 words
        words = clean_question.split()
        title = " ".join(words[:6]) + ("..." if len(words) > 6 else "")
        conversation = ChatConversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            title=title or "Study Discussion",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # 2. Check if user has uploaded any documents
    user_docs_count = db.query(Document).filter(Document.user_id == current_user.id).count()

    # 3. Check for Conversational Greeting
    if gemini_service.is_greeting(clean_question):
        greeting_text = gemini_service.get_greeting_response(current_user.full_name)
        
        # Save messages to DB
        user_msg = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            role="user",
            message=clean_question,
            timestamp=datetime.now(timezone.utc)
        )
        asst_msg = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            role="assistant",
            message=greeting_text,
            timestamp=datetime.now(timezone.utc),
            source_metadata="[]"
        )
        db.add(user_msg)
        db.add(asst_msg)
        conversation.updated_at = datetime.now(timezone.utc)
        db.commit()

        return ChatResponse(
            answer=greeting_text,
            sources=[],
            conversation_id=conversation.id,
            message_id=asst_msg.id,
            grounded=False,
            llm_provider="Conversational Agent",
            model_used="StudyMind Conversational",
            execution_time_ms=round((time.time() - start_time) * 1000, 2)
        )

    # If no documents are uploaded yet, or student is asking a general academic question without an attached PDF
    if user_docs_count == 0:
        gen_result = gemini_service.generate_general_academic_answer(
            question=clean_question,
            user_name=current_user.full_name
        )
        user_msg = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            role="user",
            message=clean_question,
            timestamp=datetime.now(timezone.utc)
        )
        asst_msg = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            role="assistant",
            message=gen_result["answer"],
            timestamp=datetime.now(timezone.utc),
            source_metadata="[]"
        )
        db.add(user_msg)
        db.add(asst_msg)
        conversation.updated_at = datetime.now(timezone.utc)
        db.commit()

        return ChatResponse(
            answer=gen_result["answer"],
            sources=[],
            conversation_id=conversation.id,
            message_id=asst_msg.id,
            grounded=False,
            llm_provider="StudyMind AI Tutor",
            model_used=gen_result.get("model_used", "general-academic-tutor"),
            execution_time_ms=round((time.time() - start_time) * 1000, 2)
        )

    # 4. Generate query embedding
    query_vector = embedding_service.embed_query(clean_question)

    # 5. Semantic Vector Search with User Isolation
    # Verify requested document IDs belong to current user
    target_doc_ids = None
    if request.document_ids and len(request.document_ids) > 0:
        valid_docs = db.query(Document.id).filter(
            Document.id.in_(request.document_ids),
            Document.user_id == current_user.id
        ).all()
        target_doc_ids = [d[0] for d in valid_docs]

    top_k = request.top_k if request.top_k and request.top_k > 0 else 4
    search_results = vector_store.search(
        query_vector=query_vector,
        query_text=clean_question,
        top_k=top_k,
        user_id=current_user.id,
        document_ids=target_doc_ids,
        score_threshold=0.08
    )

    # 6. Format Citations
    citations: List[SourceCitation] = []
    for chunk, score in search_results:
        citations.append(
            SourceCitation(
                document_id=chunk.document_id,
                filename=chunk.filename,
                page_number=chunk.page_number,
                text=chunk.text,
                relevance_score=round(float(score), 4)
            )
        )

    # 7. Generate Grounded Answer via Gemini / Synthesizer
    gen_result = gemini_service.generate_rag_answer(
        question=clean_question,
        citations=citations,
        user_name=current_user.full_name
    )

    # 8. Persist User and Assistant Messages in Database
    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="user",
        message=clean_question,
        timestamp=datetime.now(timezone.utc)
    )
    citations_json = json.dumps([c.model_dump() for c in citations])
    asst_msg = ChatMessage(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="assistant",
        message=gen_result["answer"],
        timestamp=datetime.now(timezone.utc),
        source_metadata=citations_json
    )

    db.add(user_msg)
    db.add(asst_msg)
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()

    exec_time = round((time.time() - start_time) * 1000, 2)

    return ChatResponse(
        answer=gen_result["answer"],
        sources=citations,
        conversation_id=conversation.id,
        message_id=asst_msg.id,
        grounded=gen_result.get("grounded", True),
        llm_provider="Google Gemini" if gemini_service.is_configured() else "Local RAG Engine",
        model_used=gen_result.get("model_used", "gemini-1.5-flash"),
        execution_time_ms=exec_time
    )


@router.get("/history", response_model=List[ConversationSummary])
def get_user_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all chat conversations for the current user."""
    convs = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()

    summaries = []
    for c in convs:
        count = len(c.messages)
        summaries.append(
            ConversationSummary(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=count
            )
        )
    return summaries


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full message history for a specific conversation."""
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )

    formatted_messages = []
    for m in conv.messages:
        sources_list = []
        if m.source_metadata:
            try:
                parsed = json.loads(m.source_metadata)
                sources_list = [SourceCitation(**item) for item in parsed]
            except Exception:
                sources_list = []
        formatted_messages.append(
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                message=m.message,
                timestamp=m.timestamp,
                sources=sources_list
            )
        )

    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=formatted_messages
    )


@router.delete("/{conversation_id}", response_model=dict)
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a conversation and all its messages."""
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )

    db.delete(conv)
    db.commit()
    return {"success": True, "message": "Conversation deleted successfully."}


@router.delete("/history/all", response_model=dict)
def clear_all_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all chat conversations for the current user."""
    convs = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).all()
    for c in convs:
        db.delete(c)
    db.commit()
    return {"success": True, "message": "All conversations cleared."}
