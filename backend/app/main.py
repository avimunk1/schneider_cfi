import os
import time
import uuid
import threading
import traceback
from pathlib import Path
from typing import Dict
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from . import schemas
from . import orchestrator
from .logger import logger


BASE_DIR = Path(__file__).resolve().parent.parent

# Assets directory: use Railway volume mount if available, fallback to local
# Railway volume will be mounted at /app/assets in production
ASSETS_DIR = Path(os.getenv("ASSETS_PATH", BASE_DIR.parent / "assets"))
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# Logs directory for analytics/feedback CSV files
LOG_DIR = Path(os.getenv("SESSION_LOG_PATH", ASSETS_DIR / "logs"))
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Admin authentication token
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-this-in-production")

# In-memory progress store (use Redis for production)
_generation_status: Dict[str, schemas.GenerationProgress] = {}

app = FastAPI(title="Schneider CFI Backend", version="0.1.0")

allowed_origin = os.getenv("ALLOWED_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin] if allowed_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "time": int(time.time())}


@app.post("/api/boards/preview", response_model=schemas.PreviewResponse)
def api_preview(req: schemas.PreviewRequest):
    request_id = uuid.uuid4().hex[:8]
    try:
        logger.info("Preview request", request_id=request_id, session_id=req.session_id)
        return orchestrator.handle_preview(req)
    except Exception as e:
        logger.error("Preview request failed", request_id=request_id, error=str(e), exc_info=True)
        detail = {"message": str(e), "request_id": request_id}
        session_id = getattr(e, "session_id", None) or req.session_id
        if session_id:
            detail["session_id"] = session_id
        raise HTTPException(status_code=400, detail=detail)


@app.post("/api/boards/generate", response_model=schemas.GenerateResponse)
def api_generate(req: schemas.GenerateRequest):
    request_id = uuid.uuid4().hex[:8]
    session_id = req.session_id or uuid.uuid4().hex
    if not req.session_id:
        req = req.copy(update={"session_id": session_id})
    try:
        logger.info("Generate request", request_id=request_id, session_id=session_id)
        return orchestrator.handle_generate(req, assets_dir=str(ASSETS_DIR))
    except Exception as e:
        logger.error("Generate request failed", request_id=request_id, session_id=session_id, error=str(e), exc_info=True)
        detail = {"message": str(e), "request_id": request_id}
        detail["session_id"] = getattr(e, "session_id", session_id)
        raise HTTPException(status_code=400, detail=detail)


@app.post("/api/boards/generate/start", response_model=schemas.GenerateStartResponse)
def api_generate_start(req: schemas.GenerateRequest):
    """Start async generation and return job_id"""
    job_id = uuid.uuid4().hex[:8]
    session_id = req.session_id or uuid.uuid4().hex
    if not req.session_id:
        req = req.copy(update={"session_id": session_id})
    
    # Initialize progress
    _generation_status[job_id] = schemas.GenerationProgress(
        status="in_progress",
        completed_count=0,
        total_count=len(req.parsed.entities),
        message="מתחיל ליצור תמונות..."
    )
    
    # Run in background thread
    def _run():
        try:
            result = orchestrator.handle_generate(req, str(ASSETS_DIR), job_id)
            _generation_status[job_id].status = "completed"
            _generation_status[job_id].message = "הלוח מוכן!"
            # Store assets in progress object
            if job_id in _generation_status:
                _generation_status[job_id] = schemas.GenerationProgress(
                    status="completed",
                    completed_count=_generation_status[job_id].total_count,
                    total_count=_generation_status[job_id].total_count,
                    message="הלוח מוכן!",
                    current_entity=None
                )
                # We'll need to store assets separately
                _generation_status[f"{job_id}_assets"] = result.assets
        except Exception as e:
            logger.error("Async generation failed", job_id=job_id, error=str(e), exc_info=True)
            if job_id in _generation_status:
                _generation_status[job_id].status = "error"
                _generation_status[job_id].message = f"שגיאה: {str(e)}"
    
    threading.Thread(target=_run, daemon=True).start()
    return schemas.GenerateStartResponse(job_id=job_id, session_id=session_id, user_name=req.user_name)


@app.get("/api/boards/generate/status/{job_id}", response_model=schemas.ProgressResponse)
def api_generate_status(job_id: str):
    """Poll generation progress"""
    if job_id not in _generation_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    progress = _generation_status[job_id]
    assets = None
    
    # Check if assets are available
    if progress.status == "completed" and f"{job_id}_assets" in _generation_status:
        assets = _generation_status[f"{job_id}_assets"]
    
    return schemas.ProgressResponse(progress=progress, assets=assets)


@app.post("/api/feedback")
def api_feedback(req: schemas.FeedbackRequest):
    """Record user feedback for a session"""
    request_id = uuid.uuid4().hex[:8]
    logger.info("Feedback received", request_id=request_id, session_id=req.session_id, rating=req.rating)
    
    try:
        from .tools import conversation_logger
        conversation_logger.record_feedback(
            session_id=req.session_id,
            rating=req.rating,
            comment=req.comment
        )
        return {"status": "ok"}
    except Exception as e:
        logger.error("Feedback submission failed", request_id=request_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=400, detail={"message": str(e), "request_id": request_id})


# ============================================================================
# Admin Endpoints - Download Analytics & Logs
# ============================================================================

def verify_admin_token(authorization: str = Header(None)):
    """Verify admin authentication token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    # Support both "Bearer TOKEN" and just "TOKEN" format
    token = authorization.replace("Bearer ", "").strip()
    
    if token != ADMIN_TOKEN:
        logger.warning("Unauthorized admin access attempt")
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    return token


@app.get("/api/admin/logs/kpis")
def download_kpis(token: str = Depends(verify_admin_token)):
    """Download conversation KPIs CSV file
    
    Contains session summaries with metrics like duration, images created, etc.
    
    Usage:
        curl -H "Authorization: Bearer YOUR_TOKEN" \
             https://your-backend.railway.app/api/admin/logs/kpis \
             -o kpis.csv
    """
    file_path = LOG_DIR / "conversation_kpis.csv"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="KPIs file not found. No sessions recorded yet.")
    
    logger.info("Admin downloading KPIs file", file_size=file_path.stat().st_size)
    return FileResponse(
        path=str(file_path),
        filename="conversation_kpis.csv",
        media_type="text/csv"
    )


@app.get("/api/admin/logs/details")
def download_details(token: str = Depends(verify_admin_token)):
    """Download detailed conversation logs (NDJSON format)
    
    Contains full conversation history, LLM outputs, errors, and assets for each session.
    
    Usage:
        curl -H "Authorization: Bearer YOUR_TOKEN" \
             https://your-backend.railway.app/api/admin/logs/details \
             -o details.ndjson
    """
    file_path = LOG_DIR / "conversation_details.ndjson"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Details file not found. No sessions recorded yet.")
    
    logger.info("Admin downloading details file", file_size=file_path.stat().st_size)
    return FileResponse(
        path=str(file_path),
        filename="conversation_details.ndjson",
        media_type="application/x-ndjson"
    )


@app.get("/api/admin/logs/feedback")
def download_feedback(token: str = Depends(verify_admin_token)):
    """Download user feedback CSV file
    
    Contains user ratings and comments for each session.
    
    Usage:
        curl -H "Authorization: Bearer YOUR_TOKEN" \
             https://your-backend.railway.app/api/admin/logs/feedback \
             -o feedback.csv
    """
    file_path = LOG_DIR / "user_feedback.csv"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Feedback file not found. No feedback submitted yet.")
    
    logger.info("Admin downloading feedback file", file_size=file_path.stat().st_size)
    return FileResponse(
        path=str(file_path),
        filename="user_feedback.csv",
        media_type="text/csv"
    )


