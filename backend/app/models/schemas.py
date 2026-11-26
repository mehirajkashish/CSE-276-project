from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

# --- Authentication Schemas ---
class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    confirm_new_password: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordVerifyRequest(BaseModel):
    email: EmailStr
    reset_code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str = Field(..., min_length=6, max_length=100)
    confirm_new_password: str

class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Document Schemas ---
class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    file_path: str
    file_size: int
    upload_date: datetime
    processing_status: str
    total_pages: int
    total_chunks: int

    class Config:
        from_attributes = True

# Backward compatibility alias
DocumentMetadata = DocumentResponse

class DocumentChunk(BaseModel):
    id: str
    document_id: str
    user_id: Optional[str] = None
    filename: str
    page_number: int
    chunk_index: int
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SourceCitation(BaseModel):
    document_id: str
    filename: str
    page_number: int
    text: str
    relevance_score: float

# --- Chat Schemas ---
class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    document_ids: Optional[List[str]] = Field(default_factory=list)
    top_k: Optional[int] = 4
    explanation_level: Optional[str] = "intermediate"  # "beginner" | "intermediate" | "advanced"
    mode: Optional[str] = "learn"  # "learn" | "exam" | "practice" | "code" | "research"
    replace_from_message_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceCitation]
    conversation_id: str
    message_id: str
    user_message_id: Optional[str] = None
    grounded: bool = True
    not_found_in_docs: bool = False
    mode: str = "learn"
    explanation_level: str = "intermediate"
    title: Optional[str] = None
    llm_provider: str = "Gemini"
    model_used: str = "gemini-flash-lite-latest"
    execution_time_ms: float

class ConversationRenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)

class MessageFeedbackRequest(BaseModel):
    feedback: Optional[str] = None  # "helpful" | "not_helpful" | None

class ChatActionRequest(BaseModel):
    action_type: str  # "explain_simpler" | "example" | "summarize" | "mcqs" | "flashcards" | "practice_questions"
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    document_ids: Optional[List[str]] = Field(default_factory=list)
    explanation_level: Optional[str] = "intermediate"
    mode: Optional[str] = "learn"

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str  # "user" or "assistant"
    message: str
    timestamp: datetime
    sources: Optional[List[SourceCitation]] = None
    feedback: Optional[str] = None

    class Config:
        from_attributes = True

class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

    class Config:
        from_attributes = True

class ConversationDetail(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]

    class Config:
        from_attributes = True

# --- Dashboard Schemas ---
class DashboardStatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    total_questions: int
    total_conversations: int
    recent_documents: List[DocumentResponse]
    recent_conversations: List[ConversationSummary]
    llm_configured: bool
    llm_model: str

# --- Study Tools Schemas ---
class StudySummaryRequest(BaseModel):
    document_id: str
    style: Optional[str] = "detailed"  # "brief", "detailed", "bulleted"

class FlashcardItem(BaseModel):
    question: str
    answer: str
    page_number: int
    key_concept: str

class FlashcardResponse(BaseModel):
    document_id: str
    filename: str
    flashcards: List[FlashcardItem]

class QuizOption(BaseModel):
    id: str
    text: str

class QuizItem(BaseModel):
    question: str
    options: List[QuizOption]
    correct_option_id: str
    explanation: str
    page_number: int

class QuizResponse(BaseModel):
    document_id: str
    filename: str
    quiz: List[QuizItem]

class ExplainSimplyRequest(BaseModel):
    topic: str
    document_id: Optional[str] = None

class RevisionNotesResponse(BaseModel):
    document_id: str
    filename: str
    title: str
    high_yield_points: List[str]
    important_definitions: List[Dict[str, str]]
    potential_exam_questions: List[str]

class ImportantTopicsResponse(BaseModel):
    document_id: str
    filename: str
    topics: List[Dict[str, Any]]

# --- Settings Schemas ---
class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k: Optional[int] = None
    similarity_threshold: Optional[float] = None
