from typing import List, Optional
from pydantic import BaseModel, Field


class PatientProfile(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    can_read: Optional[bool] = None
    second_language: Optional[str] = None


class Preferences(BaseModel):
    layout: Optional[str] = None  # e.g., "2x4", "3x3"
    paper_size: Optional[str] = None  # e.g., "A5"
    second_language: Optional[str] = None


class PreviewRequest(BaseModel):
    patient_profile: PatientProfile
    board_description: str
    preferences: Optional[Preferences] = None


class ParsedBoard(BaseModel):
    topic: Optional[str] = None
    entities: List[str] = Field(default_factory=list)
    layout: str = "2x4"


class PreviewProfile(BaseModel):
    labels_languages: List[str]
    image_style: str  # e.g., "realistic_explicit" | "cartoon_clean"


class Checks(BaseModel):
    ok: bool
    missing: List[str] = Field(default_factory=list)


class PreviewResponse(BaseModel):
    parsed: ParsedBoard
    profile: PreviewProfile
    checks: Checks
    summary: str


class GenerateParsed(BaseModel):
    layout: str
    entities: List[str]


class GenerateProfile(BaseModel):
    labels_languages: List[str]
    image_style: str


class GenerateRequest(BaseModel):
    parsed: GenerateParsed
    profile: GenerateProfile
    title: str


class Assets(BaseModel):
    png_url: str
    pdf_url: str


class Timings(BaseModel):
    images: int
    render: int


class GenerateResponse(BaseModel):
    assets: Assets
    timings_ms: Timings


