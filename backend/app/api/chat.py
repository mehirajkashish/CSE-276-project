import time
import json
import uuid
import re
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user
from app.models.db_models import User, Document, ChatConversation, ChatMessage
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    SourceCitation,
    ConversationSummary,
    ConversationDetail,
    MessageResponse,
    ConversationRenameRequest,
    MessageFeedbackRequest,
    ChatActionRequest,
)
from app.rag.embeddings import embedding_service
from app.rag.vector_store import vector_store
from app.services.gemini_service import gemini_service
from app.services.study_service import study_service

router = APIRouter(prefix="/chat", tags=["Chat"])

FOLLOW_UP_MARKERS = (
    "it", "that", "this", "these", "those", "above", "previous",
    "simpler", "simple", "example", "summarize", "summary", "more",
    "why", "how", "step", "explain", "elaborate", "clarify",
)


def _load_user_conversation_history(db: Session, conversation_id: str, user_id: str, limit: int = 12) -> List[Dict[str, str]]:
    """Loads conversation turns strictly scoped to the authenticated user & thread."""
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == user_id,
    ).first()
    if not conv:
        return []
    msgs = conv.messages[-limit:] if len(conv.messages) > limit else conv.messages
    return [
        {"id": m.id, "role": m.role, "content": m.message}
        for m in msgs
    ]


def _build_retrieval_query(clean_question: str, history: List[Dict[str, str]]) -> str:
    """Expands short or pronoun-heavy follow-up questions with recent conversation context."""
    words = clean_question.split()
    lowered_tokens = set(re.findall(r"[a-z]+", clean_question.lower()))
    looks_like_followup = len(words) <= 7 or bool(lowered_tokens.intersection(FOLLOW_UP_MARKERS))
    if not looks_like_followup or not history:
        return clean_question

    recent_user_turns = [
        h["content"] for h in history if h.get("role") == "user" and h.get("content")
    ]
    if not recent_user_turns:
        return clean_question
    anchor = recent_user_turns[-1][:180]
    return f"{anchor} {clean_question}"


def _resolve_or_create_conversation(
    db: Session,
    current_user: User,
    conversation_id: Optional[str],
    initial_question: str,
) -> ChatConversation:
    conversation = None
    if conversation_id:
        conversation = db.query(ChatConversation).filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == current_user.id,
        ).first()

    if not conversation:
        conversation = ChatConversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            title=gemini_service.generate_conversation_title(initial_question),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    return conversation


def _truncate_messages_from(db: Session, conversation_id: str, replace_from_message_id: str) -> None:
    """Deletes target message and subsequent messages in ordered sequence for clean Edit/Regenerate."""
    conv = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
    if not conv:
        return
    ordered = list(conv.messages)
    cut_idx = next((idx for idx, m in enumerate(ordered) if m.id == replace_from_message_id), None)
    if cut_idx is None:
        return
    for item in ordered[cut_idx:]:
        db.delete(item)
    db.commit()


def _retrieve_citations_for_user(
    db: Session,
    user_id: str,
    retrieval_query: str,
    requested_doc_ids: Optional[List[str]],
    top_k: int,
    score_threshold: float = 0.08,
) -> Tuple[List[SourceCitation], List[str], int]:
    """Retrieves hybrid RAG citations strictly scoped to authenticated user's documents."""
    user_docs = db.query(Document).filter(Document.user_id == user_id).all()
    if not user_docs:
        return [], [], 0

    target_doc_ids = None
    searched_names = [d.filename for d in user_docs]
    if requested_doc_ids and len(requested_doc_ids) > 0:
        valid_docs = [d for d in user_docs if d.id in requested_doc_ids]
        target_doc_ids = [d.id for d in valid_docs]
        searched_names = [d.filename for d in valid_docs]

    vector_store.safe_reindex_missing()
    query_vector = embedding_service.embed_query(retrieval_query)
    search_results = vector_store.search(
        query_vector=query_vector,
        query_text=retrieval_query,
        top_k=top_k,
        user_id=user_id,
        document_ids=target_doc_ids,
        score_threshold=score_threshold,
        enable_rerank=True,
    )

    citations = [
        SourceCitation(
            document_id=chunk.document_id,
            filename=chunk.filename,
            page_number=chunk.page_number,
            text=chunk.text,
            relevance_score=round(float(score), 4),
        )
        for chunk, score in search_results
    ]
    return citations, searched_names, len(user_docs)


def _persist_turn(
    db: Session,
    conversation_id: str,
    user_text: str,
    assistant_text: str,
    citations: List[SourceCitation],
    user_msg_id: Optional[str] = None,
    asst_msg_id: Optional[str] = None,
) -> Tuple[ChatMessage, ChatMessage]:
    now_u = datetime.now(timezone.utc)
    now_a = datetime.now(timezone.utc)
    user_msg = ChatMessage(
        id=user_msg_id or str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="user",
        message=user_text,
        timestamp=now_u,
    )
    asst_msg = ChatMessage(
        id=asst_msg_id or str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="assistant",
        message=assistant_text,
        timestamp=now_a,
        source_metadata=json.dumps([c.model_dump() for c in citations]),
    )
    db.add(user_msg)
    db.add(asst_msg)
    conv = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
    if conv:
        conv.updated_at = now_a
    db.commit()
    return user_msg, asst_msg


def _prepare_chat_context(db: Session, current_user: User, request: ChatRequest) -> Dict[str, Any]:
    clean_question = request.question.strip()
    if not clean_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    level = gemini_service.normalize_level(request.explanation_level)
    mode = gemini_service.normalize_mode(request.mode)
    conversation = _resolve_or_create_conversation(
        db, current_user, request.conversation_id, clean_question
    )

    if request.replace_from_message_id:
        _truncate_messages_from(db, conversation.id, request.replace_from_message_id)

    history = _load_user_conversation_history(db, conversation.id, current_user.id)
    top_k = request.top_k if request.top_k and request.top_k > 0 else (6 if mode == "research" else 4)

    is_greeting = gemini_service.is_casual_conversation(clean_question)
    citations: List[SourceCitation] = []
    searched_names: List[str] = []
    user_docs_count = 0

    if not is_greeting:
        retrieval_query = _build_retrieval_query(clean_question, history)
        citations, searched_names, user_docs_count = _retrieve_citations_for_user(
            db=db,
            user_id=current_user.id,
            retrieval_query=retrieval_query,
            requested_doc_ids=request.document_ids,
            top_k=top_k,
        )

    strict_doc_missing = (not is_greeting) and (user_docs_count > 0) and (len(citations) == 0)

    return {
        "clean_question": clean_question,
        "conversation": conversation,
        "history": history,
        "level": level,
        "mode": mode,
        "model": (request.model or "").strip() or None,
        "is_greeting": is_greeting,
        "citations": citations,
        "searched_names": searched_names,
        "user_docs_count": user_docs_count,
        "strict_doc_missing": strict_doc_missing,
    }


@router.post("", response_model=ChatResponse)
def chat_with_rag(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    RAG Chat Assistant Endpoint supporting conversation memory, smart modes,
    explanation levels, multi-document retrieval, and strict grounding.
    """
    start_time = time.time()
    ctx = _prepare_chat_context(db, current_user, request)
    conv: ChatConversation = ctx["conversation"]

    gen_result = gemini_service.generate_rag_answer(
        question=ctx["clean_question"],
        citations=ctx["citations"],
        user_name=current_user.full_name,
        conversation_history=ctx["history"],
        level=ctx["level"],
        mode=ctx["mode"],
        model=ctx["model"],
        strict_doc_missing=ctx["strict_doc_missing"],
        searched_docs=ctx["searched_names"],
    )

    user_msg, asst_msg = _persist_turn(
        db, conv.id, ctx["clean_question"], gen_result["answer"], ctx["citations"]
    )
    exec_time = round((time.time() - start_time) * 1000, 2)

    return ChatResponse(
        answer=gen_result["answer"],
        sources=ctx["citations"],
        conversation_id=conv.id,
        message_id=asst_msg.id,
        user_message_id=user_msg.id,
        grounded=gen_result.get("grounded", bool(ctx["citations"])),
        not_found_in_docs=gen_result.get("not_found_in_docs", ctx["strict_doc_missing"]),
        mode=ctx["mode"],
        explanation_level=ctx["level"],
        title=conv.title,
        llm_provider="Google Gemini" if gemini_service.is_configured() else "StudyMind AI Tutor",
        model_used=gen_result.get("model_used", "gemini-flash-lite-latest"),
        execution_time_ms=exec_time,
    )


@router.post("/stream")
def stream_chat_with_rag(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """SSE streaming chat endpoint yielding meta, chunk, done, and error events cleanly."""
    start_time = time.time()
    ctx = _prepare_chat_context(db, current_user, request)
    conv: ChatConversation = ctx["conversation"]
    conv_id = conv.id
    conv_title = conv.title
    citations: List[SourceCitation] = ctx["citations"]
    user_msg_id = str(uuid.uuid4())
    asst_msg_id = str(uuid.uuid4())
    user_full_name = current_user.full_name

    def sse_event(name: str, data_obj: Dict[str, Any]) -> str:
        return f"event: {name}\ndata: {json.dumps(data_obj, ensure_ascii=False)}\n\n"

    def event_generator():
        yield sse_event(
            "meta",
            {
                "conversation_id": conv_id,
                "user_message_id": user_msg_id,
                "message_id": asst_msg_id,
                "title": conv_title,
                "sources": [c.model_dump() for c in citations],
                "grounded": bool(citations) and not ctx["is_greeting"],
                "not_found_in_docs": ctx["strict_doc_missing"],
                "mode": ctx["mode"],
                "explanation_level": ctx["level"],
            },
        )

        chunks_acc: List[str] = []
        used_model = "StudyMind Conversational" if ctx["is_greeting"] else "local-rag-synthesizer"
        saved = False
        stream_db = SessionLocal()

        try:
            for item in gemini_service.stream_chat_response(
                question=ctx["clean_question"],
                citations=citations,
                user_name=user_full_name,
                conversation_history=ctx["history"],
                level=ctx["level"],
                mode=ctx["mode"],
                model=ctx["model"],
                strict_doc_missing=ctx["strict_doc_missing"],
                searched_docs=ctx["searched_names"],
            ):
                piece = item.get("text", "")
                if item.get("model_used"):
                    used_model = item["model_used"]
                if piece:
                    chunks_acc.append(piece)
                    yield sse_event("chunk", {"text": piece})

            full_answer = "".join(chunks_acc).strip()
            if full_answer:
                _persist_turn(
                    stream_db,
                    conv_id,
                    ctx["clean_question"],
                    full_answer,
                    citations,
                    user_msg_id=user_msg_id,
                    asst_msg_id=asst_msg_id,
                )
                saved = True

            yield sse_event(
                "done",
                {
                    "conversation_id": conv_id,
                    "message_id": asst_msg_id,
                    "user_message_id": user_msg_id,
                    "answer": full_answer,
                    "title": conv_title,
                    "model_used": used_model,
                    "llm_provider": "Google Gemini" if gemini_service.is_configured() else "StudyMind AI Tutor",
                    "execution_time_ms": round((time.time() - start_time) * 1000, 2),
                },
            )
        except GeneratorExit:
            # Persist stopped partial response cleanly if non-empty, never creating duplicates
            partial = "".join(chunks_acc).strip()
            if partial and not saved:
                try:
                    _persist_turn(
                        stream_db,
                        conv_id,
                        ctx["clean_question"],
                        partial,
                        citations,
                        user_msg_id=user_msg_id,
                        asst_msg_id=asst_msg_id,
                    )
                except Exception:
                    pass
        except Exception as e:
            yield sse_event("error", {"detail": str(e)})
        finally:
            stream_db.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _format_mcqs_markdown(filename: str, quiz_items: list) -> str:
    lines = [f"### Practice MCQs ({filename})\n"]
    for idx, q in enumerate(quiz_items, 1):
        q_text = q.question if hasattr(q, "question") else q.get("question", "")
        opts = q.options if hasattr(q, "options") else q.get("options", [])
        corr = q.correct_option_id if hasattr(q, "correct_option_id") else q.get("correct_option_id", "A")
        expl = q.explanation if hasattr(q, "explanation") else q.get("explanation", "")
        pg = q.page_number if hasattr(q, "page_number") else q.get("page_number", 1)
        lines.append(f"**Q{idx}.** {q_text} *(Page {pg})*")
        for opt in opts:
            oid = opt.id if hasattr(opt, "id") else opt.get("id", "")
            otext = opt.text if hasattr(opt, "text") else opt.get("text", "")
            lines.append(f"- **{oid}.** {otext}")
        lines.append(f"\n> **Answer:** **{corr}** — {expl}\n")
    return "\n".join(lines).strip()


def _format_flashcards_markdown(filename: str, cards: list) -> str:
    lines = [
        f"### Active Recall Flashcards ({filename})\n",
        "| # | Concept | Question / Front | Answer / Back | Page |",
        "| --- | --- | --- | --- | --- |",
    ]
    for idx, card in enumerate(cards, 1):
        concept = (card.key_concept if hasattr(card, "key_concept") else card.get("key_concept", "Key Term")).replace("|", "/")
        q = (card.question if hasattr(card, "question") else card.get("question", "")).replace("|", "/")
        a = (card.answer if hasattr(card, "answer") else card.get("answer", "")).replace("|", "/")
        pg = card.page_number if hasattr(card, "page_number") else card.get("page_number", 1)
        lines.append(f"| {idx} | **{concept}** | {q} | {a} | p.{pg} |")
    return "\n".join(lines).strip()


def _format_practice_markdown(filename: str, items: list) -> str:
    lines = [f"### Practice Questions ({filename})\n"]
    for idx, pq in enumerate(items, 1):
        q_type = pq.get("type", "Practice Question")
        diff = pq.get("difficulty", "Medium")
        q_txt = pq.get("question", "")
        sol = pq.get("solution", "")
        pg = pq.get("page", 1)
        lines.append(f"**{idx}. [{q_type} • {diff}]** {q_txt} *(Page {pg})*")
        if sol:
            lines.append(f"\n> **Guided Solution:** {sol}\n")
    return "\n".join(lines).strip()


@router.post("/action", response_model=ChatResponse)
def execute_chat_action(
    request: ChatActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes contextual response actions (Explain Simpler, Give Example, Summarize,
    Generate MCQs, Create Flashcards, Practice Questions) using real backend Study & RAG services.
    """
    start_time = time.time()
    action = (request.action_type or "").strip().lower()
    valid_actions = {
        "explain_simpler": "Explain this concept in simpler beginner-friendly terms with a clear analogy.",
        "example": "Give a concrete worked example illustrating this concept.",
        "summarize": "Summarize the key takeaways into concise bullet points.",
        "mcqs": "Generate 4 practice multiple-choice questions (MCQs) with explanations.",
        "flashcards": "Create active recall flashcards with key concepts and answers.",
        "practice_questions": "Generate exam-style practice questions with solutions.",
    }
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Unsupported action_type '{request.action_type}'.")

    # Identify referenced assistant message & document scope if any
    ref_msg = None
    conv = None
    if request.conversation_id:
        conv = db.query(ChatConversation).filter(
            ChatConversation.id == request.conversation_id,
            ChatConversation.user_id == current_user.id,
        ).first()
    if request.message_id and conv:
        ref_msg = db.query(ChatMessage).filter(
            ChatMessage.id == request.message_id,
            ChatMessage.conversation_id == conv.id,
        ).first()

    # Determine target document ID from request filter, referenced message citations, or latest user doc
    target_doc_id = request.document_ids[0] if request.document_ids else None
    ref_citations: List[SourceCitation] = []
    if ref_msg and ref_msg.source_metadata:
        try:
            ref_citations = [SourceCitation(**item) for item in json.loads(ref_msg.source_metadata)]
            if not target_doc_id and ref_citations:
                target_doc_id = ref_citations[0].document_id
        except Exception:
            ref_citations = []

    if not target_doc_id:
        latest_doc = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.upload_date.desc()).first()
        if latest_doc:
            target_doc_id = latest_doc.id

    user_prompt_label = valid_actions[action]
    if not conv:
        conv = _resolve_or_create_conversation(db, current_user, None, user_prompt_label)

    # Route document-level toolkit actions to real study_service when a document is available
    answer_text = ""
    sources_out = ref_citations
    model_used = "study-service"

    if target_doc_id and action in ("mcqs", "flashcards", "practice_questions", "summarize"):
        doc_obj = db.query(Document).filter(Document.id == target_doc_id, Document.user_id == current_user.id).first()
        doc_name = doc_obj.filename if doc_obj else "Study Material"
        if not sources_out and doc_obj:
            chunks = vector_store.get_document_chunks(doc_obj.id, user_id=current_user.id)[:3]
            sources_out = [
                SourceCitation(
                    document_id=c.document_id,
                    filename=c.filename,
                    page_number=c.page_number,
                    text=c.text,
                    relevance_score=0.92,
                )
                for c in chunks
            ]

        if action == "mcqs":
            res = study_service.generate_quiz(db, current_user.id, target_doc_id, count=4)
            answer_text = _format_mcqs_markdown(doc_name, res.quiz)
        elif action == "flashcards":
            res = study_service.generate_flashcards(db, current_user.id, target_doc_id, count=5)
            answer_text = _format_flashcards_markdown(doc_name, res.flashcards)
        elif action == "practice_questions":
            res = study_service.generate_practice_questions(db, current_user.id, target_doc_id, count=4)
            answer_text = _format_practice_markdown(doc_name, res.get("practice_questions", []))
        elif action == "summarize":
            res = study_service.generate_summary(db, current_user.id, target_doc_id, style="detailed")
            answer_text = res.get("summary", "")

        if answer_text:
            user_msg, asst_msg = _persist_turn(db, conv.id, user_prompt_label, answer_text, sources_out)
            return ChatResponse(
                answer=answer_text,
                sources=sources_out,
                conversation_id=conv.id,
                message_id=asst_msg.id,
                user_message_id=user_msg.id,
                grounded=bool(sources_out),
                not_found_in_docs=False,
                mode=gemini_service.normalize_mode(request.mode),
                explanation_level=gemini_service.normalize_level(request.explanation_level),
                title=conv.title,
                llm_provider="StudyMind Study Engine",
                model_used=model_used,
                execution_time_ms=round((time.time() - start_time) * 1000, 2),
            )

    # Contextual conversational action using conversation memory & RAG citations
    history = _load_user_conversation_history(db, conv.id, current_user.id)
    target_level = "beginner" if action == "explain_simpler" else gemini_service.normalize_level(request.explanation_level)
    target_mode = "practice" if action in ("mcqs", "practice_questions") else gemini_service.normalize_mode(request.mode)
    snippet_context = f"\nFocus specifically on explaining/expanding the previous explanation:\n\"{(ref_msg.message[:600] if ref_msg else '')}\"" if ref_msg else ""

    gen_result = gemini_service.generate_rag_answer(
        question=f"{user_prompt_label}{snippet_context}",
        citations=sources_out,
        user_name=current_user.full_name,
        conversation_history=history,
        level=target_level,
        mode=target_mode,
        model=(request.model or "").strip() or None,
        strict_doc_missing=False,
    )
    user_msg, asst_msg = _persist_turn(db, conv.id, user_prompt_label, gen_result["answer"], sources_out)

    return ChatResponse(
        answer=gen_result["answer"],
        sources=sources_out,
        conversation_id=conv.id,
        message_id=asst_msg.id,
        user_message_id=user_msg.id,
        grounded=gen_result.get("grounded", bool(sources_out)),
        not_found_in_docs=False,
        mode=target_mode,
        explanation_level=target_level,
        title=conv.title,
        llm_provider="Google Gemini" if gemini_service.is_configured() else "StudyMind AI Tutor",
        model_used=gen_result.get("model_used", "gemini-flash-lite-latest"),
        execution_time_ms=round((time.time() - start_time) * 1000, 2),
    )


@router.get("/history", response_model=List[ConversationSummary])
def get_user_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all chat conversations strictly scoped to the current user."""
    convs = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()

    return [
        ConversationSummary(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        )
        for c in convs
    ]


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full message history for a specific conversation."""
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
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
                sources=sources_list,
                feedback=m.feedback,
            )
        )

    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=formatted_messages,
    )


@router.patch("/{conversation_id}", response_model=ConversationSummary)
def rename_conversation(
    conversation_id: str,
    req: ConversationRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a chat conversation owned by the current user."""
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )
    cleaned_title = req.title.strip()
    if not cleaned_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty.")

    conv.title = cleaned_title[:255]
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conv)

    return ConversationSummary(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(conv.messages),
    )


@router.post("/messages/{message_id}/feedback", response_model=dict)
def submit_message_feedback(
    message_id: str,
    req: MessageFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persist Helpful / Not Helpful feedback on an assistant message owned by the current user."""
    val = req.feedback.strip().lower() if req.feedback else None
    if val not in (None, "helpful", "not_helpful"):
        raise HTTPException(status_code=400, detail="feedback must be 'helpful', 'not_helpful', or null.")

    msg = (
        db.query(ChatMessage)
        .join(ChatConversation, ChatMessage.conversation_id == ChatConversation.id)
        .filter(
            ChatMessage.id == message_id,
            ChatConversation.user_id == current_user.id,
        )
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or access denied.")

    msg.feedback = val
    db.commit()
    return {"success": True, "message_id": msg.id, "feedback": msg.feedback}


@router.delete("/{conversation_id}", response_model=dict)
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )

    db.delete(conv)
    db.commit()
    return {"success": True, "message": "Conversation deleted successfully."}


@router.delete("/history/all", response_model=dict)
def clear_all_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear all chat conversations for the current user."""
    convs = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).all()
    for c in convs:
        db.delete(c)
    db.commit()
    return {"success": True, "message": "All conversations cleared."}
