import csv
import json
import os
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..logger import logger


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _parse_iso(value: Optional[str], fallback: datetime) -> str:
    if not value:
        return _iso(fallback)
    try:
        cleaned = value.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        parsed = datetime.fromisoformat(cleaned)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return _iso(parsed)
    except Exception:
        return _iso(fallback)


BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_ROOT = Path(os.getenv("ASSETS_PATH", BASE_DIR.parent / "assets"))
LOG_DIR = Path(os.getenv("SESSION_LOG_PATH", ASSETS_ROOT / "logs"))
LOG_DIR.mkdir(parents=True, exist_ok=True)

KPI_FILE = LOG_DIR / "conversation_kpis.csv"
DETAIL_FILE = LOG_DIR / "conversation_details.ndjson"
FEEDBACK_FILE = LOG_DIR / "user_feedback.csv"

MAX_BYTES = int(os.getenv("SESSION_LOG_MAX_BYTES", 50 * 1024 * 1024))
EXPIRE_SECONDS = int(os.getenv("SESSION_LOG_IDLE_FLUSH_SECONDS", 30 * 60))

FEEDBACK_HEADERS = ["timestamp", "session_id", "rating", "comment"]

CSV_HEADERS = [
    "session_id",
    "user_name",
    "started_at",
    "ended_at",
    "session_duration_seconds",
    "total_requests",
    "first_prompt",
    "summary",
    "images_requested",
    "images_created",
    "had_error",
]


@dataclass
class SessionData:
    session_id: str
    user_name: Optional[str]
    created_at: datetime
    updated_at: datetime
    total_requests: int = 0
    first_prompt: Optional[str] = None
    summary: Optional[str] = None
    images_requested: int = 0
    images_created: int = 0
    had_error: bool = False
    conversation: List[Dict[str, Any]] = field(default_factory=list)
    assets: Dict[str, Any] = field(default_factory=dict)
    errors: List[Dict[str, Any]] = field(default_factory=list)


_lock = threading.Lock()
_sessions: Dict[str, SessionData] = {}


def _maybe_rotate(path: Path) -> bool:
    if path.exists() and path.stat().st_size >= MAX_BYTES:
        path.unlink()
        return True
    return not path.exists() or path.stat().st_size == 0


def _write_csv_row(row: Dict[str, Any]) -> None:
    needs_header = _maybe_rotate(KPI_FILE)
    with KPI_FILE.open("a", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=CSV_HEADERS)
        if needs_header:
            writer.writeheader()
        writer.writerow(row)


def _write_ndjson(entry: Dict[str, Any]) -> None:
    _maybe_rotate(DETAIL_FILE)
    with DETAIL_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _collect_expired(now: datetime) -> List[SessionData]:
    expired: List[SessionData] = []
    for session_id, data in list(_sessions.items()):
        if (now - data.updated_at).total_seconds() >= EXPIRE_SECONDS:
            expired.append(_sessions.pop(session_id))
    return expired


def _append_history(session: SessionData, history: List[Dict[str, Any]], fallback: datetime) -> None:
    for item in history:
        role = item.get("role", "unknown")
        text = item.get("text", "")
        timestamp = _parse_iso(item.get("timestamp"), fallback)
        session.conversation.append(
            {
                "timestamp": timestamp,
                "role": role,
                "text": text,
                "source": "history",
            }
        )


def _export(session: SessionData, ended_at: datetime) -> Dict[str, Dict[str, Any]]:
    duration = max((ended_at - session.created_at).total_seconds(), 0.0)
    csv_row = {
        "session_id": session.session_id,
        "user_name": session.user_name or "",
        "started_at": _iso(session.created_at),
        "ended_at": _iso(ended_at),
        "session_duration_seconds": f"{duration:.2f}",
        "total_requests": session.total_requests,
        "first_prompt": session.first_prompt or "",
        "summary": session.summary or "",
        "images_requested": session.images_requested,
        "images_created": session.images_created,
        "had_error": session.had_error,
    }
    ndjson_entry = {
        "session_id": session.session_id,
        "user_name": session.user_name,
        "started_at": _iso(session.created_at),
        "ended_at": _iso(ended_at),
        "duration_seconds": duration,
        "total_requests": session.total_requests,
        "first_prompt": session.first_prompt,
        "summary": session.summary,
        "images_requested": session.images_requested,
        "images_created": session.images_created,
        "had_error": session.had_error,
        "conversation": session.conversation,
        "assets": session.assets,
        "errors": session.errors,
    }
    return {"csv": csv_row, "ndjson": ndjson_entry}


def record_preview_request(
    session_id: str,
    user_name: Optional[str],
    board_description: str,
    conversation_history: List[Dict[str, Any]],
) -> None:
    now = _utcnow()
    expired: List[SessionData] = []
    with _lock:
        expired = _collect_expired(now)
        session = _sessions.get(session_id)
        if session is None:
            session = SessionData(
                session_id=session_id,
                user_name=user_name,
                created_at=now,
                updated_at=now,
            )
            _sessions[session_id] = session
            if conversation_history:
                _append_history(session, conversation_history, now)
        else:
            session.updated_at = now
            if user_name and not session.user_name:
                session.user_name = user_name

        session.total_requests += 1
        if session.first_prompt is None:
            session.first_prompt = board_description

        session.conversation.append(
            {
                "timestamp": _iso(now),
                "role": "user",
                "text": board_description,
                "source": "user_request",
            }
        )

    for stale in expired:
        write_session(stale, now=now)


def record_preview_result(
    session_id: str,
    summary: Optional[str],
    llm_payload: Dict[str, Any],
) -> None:
    now = _utcnow()
    with _lock:
        session = _sessions.get(session_id)
        if session is None:
            return
        session.updated_at = now
        if summary:
            session.summary = summary
        session.conversation.append(
            {
                "timestamp": _iso(now),
                "role": "agent",
                "text": summary or "",
                "source": "preview_response",
                "llm_output": llm_payload,
            }
        )


def record_generate_start(session_id: str, image_count: int) -> None:
    now = _utcnow()
    with _lock:
        session = _sessions.get(session_id)
        if session is None:
            session = SessionData(
                session_id=session_id,
                user_name=None,
                created_at=now,
                updated_at=now,
            )
            _sessions[session_id] = session
        session.updated_at = now
        session.images_requested = max(session.images_requested, image_count)
        session.conversation.append(
            {
                "timestamp": _iso(now),
                "role": "system",
                "text": f"generation_started ({image_count})",
                "source": "generation_start",
                "images_requested": image_count,
            }
        )


def record_generate_success(
    session_id: str,
    image_files: List[str],
    board_png: str,
    board_pdf: str,
) -> None:
    now = _utcnow()
    with _lock:
        session = _sessions.get(session_id)
        if session is None:
            session = SessionData(
                session_id=session_id,
                user_name=None,
                created_at=now,
                updated_at=now,
            )
            _sessions[session_id] = session
        session.updated_at = now
        session.images_created = len(image_files)
        session.assets = {
            "image_files": image_files,
            "board_png": board_png,
            "board_pdf": board_pdf,
        }
        session.conversation.append(
            {
                "timestamp": _iso(now),
                "role": "system",
                "text": "generation_completed",
                "source": "generation_complete",
                "assets": session.assets,
            }
        )


def record_error(session_id: str, stage: str, message: str) -> None:
    now = _utcnow()
    with _lock:
        session = _sessions.get(session_id)
        if session is None:
            session = SessionData(
                session_id=session_id,
                user_name=None,
                created_at=now,
                updated_at=now,
            )
            _sessions[session_id] = session
        session.updated_at = now
        session.had_error = True
        error_entry = {
            "timestamp": _iso(now),
            "stage": stage,
            "message": message,
        }
        session.errors.append(error_entry)
        session.conversation.append(
            {
                "timestamp": _iso(now),
                "role": "system",
                "text": f"error: {message}",
                "source": "error",
                "stage": stage,
            }
        )


def write_session(session: SessionData, now: Optional[datetime] = None) -> None:
    end_time = now or _utcnow()
    payload = _export(session, end_time)
    _write_csv_row(payload["csv"])
    _write_ndjson(payload["ndjson"])


def finalize_session(session_id: str) -> None:
    with _lock:
        session = _sessions.pop(session_id, None)
    if session:
        write_session(session)


def record_feedback(session_id: str, rating: int, comment: Optional[str]) -> None:
    """
    Record user feedback to separate feedback log.
    This can be called even after session is finalized.
    """
    now = _utcnow()
    
    # Rotate feedback file if needed
    _maybe_rotate(FEEDBACK_FILE)
    
    # Write to feedback CSV
    feedback_row = {
        "timestamp": _iso(now),
        "session_id": session_id,
        "rating": rating,
        "comment": comment or "",
    }
    
    with _lock:
        file_exists = FEEDBACK_FILE.exists()
        with open(FEEDBACK_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FEEDBACK_HEADERS)
            if not file_exists:
                writer.writeheader()
            writer.writerow(feedback_row)
    
    logger.info("Feedback recorded", session_id=session_id, rating=rating)
    
    # Also append to NDJSON detail log for completeness
    detail_entry = {
        "timestamp": _iso(now),
        "session_id": session_id,
        "event": "user_feedback",
        "data": {"rating": rating, "comment": comment},
    }
    _write_ndjson(detail_entry)

