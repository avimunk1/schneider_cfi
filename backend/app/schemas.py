from typing import List, Optional
from pydantic import BaseModel, Field


class PatientProfile(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    can_read: Optional[bool] = None
    second_language: Optional[str] = None
    religion: Optional[str] = None  # דתי/לא דתי
    sector: Optional[str] = None  # חילוני/מסורתי/דתי/חרדי/מוסלמי/נוצרי/דרוזי


class Preferences(BaseModel):
    layout: Optional[str] = None  # e.g., "2x4", "3x3"
    paper_size: Optional[str] = None  # e.g., "A5"
    second_language: Optional[str] = None


class ConversationMessage(BaseModel):
    role: str  # "user" | "agent"
    text: str
    timestamp: Optional[str] = None


class PreviewRequest(BaseModel):
    patient_profile: PatientProfile
    board_description: str
    preferences: Optional[Preferences] = None
    conversation_history: List[ConversationMessage] = Field(default_factory=list)
    session_id: Optional[str] = None
    user_name: Optional[str] = None


class ParsedBoard(BaseModel):
    topic: Optional[str] = None
    entities: List[str] = Field(default_factory=list)
    layout: str = "2x4"


class PreviewProfile(BaseModel):
    labels_languages: List[str]
    image_style: str  # e.g., "realistic_explicit" | "cartoon_clean"
    age: Optional[int] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    can_read: Optional[bool] = None
    religion: Optional[str] = None
    sector: Optional[str] = None


class Checks(BaseModel):
    ok: bool
    missing: List[str] = Field(default_factory=list)


class PreviewResponse(BaseModel):
    parsed: ParsedBoard
    profile: PreviewProfile
    checks: Checks
    summary: str
    session_id: str
    user_name: Optional[str] = None


class GenerateParsed(BaseModel):
    layout: str
    entities: List[str]
    topic: Optional[str] = None


class GenerateProfile(BaseModel):
    labels_languages: List[str]
    image_style: str
    age: Optional[int] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    can_read: Optional[bool] = None
    religion: Optional[str] = None
    sector: Optional[str] = None


class GenerateRequest(BaseModel):
    parsed: GenerateParsed
    profile: GenerateProfile
    title: str
    session_id: str
    user_name: Optional[str] = None


class Assets(BaseModel):
    png_url: str
    pdf_url: str
    image_files: Optional[List[str]] = None  # List of individual image filenames


class Timings(BaseModel):
    images: int
    render: int


class GenerateResponse(BaseModel):
    assets: Assets
    timings_ms: Timings
    session_id: str
    user_name: Optional[str] = None


class GenerationProgress(BaseModel):
    status: str  # "in_progress" | "completed" | "error"
    current_entity: Optional[str] = None
    completed_count: int = 0
    total_count: int = 0
    message: str  # User-facing message in their language


class ProgressResponse(BaseModel):
    progress: GenerationProgress
    assets: Optional[Assets] = None  # Only present when status="completed"


class GenerateStartResponse(BaseModel):
    job_id: str
    session_id: str
    user_name: Optional[str] = None


class FeedbackRequest(BaseModel):
    session_id: str
    rating: int = Field(..., ge=1, le=5, description="Star rating 1-5")
    comment: Optional[str] = Field(None, max_length=1000, description="Optional text feedback")


