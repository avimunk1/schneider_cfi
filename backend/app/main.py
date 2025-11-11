import os
import time
import uuid
import threading
from pathlib import Path
from typing import Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import schemas
from . import orchestrator


BASE_DIR = Path(__file__).resolve().parent.parent

# Assets directory: use Railway volume mount if available, fallback to local
# Railway volume will be mounted at /app/assets in production
ASSETS_DIR = Path(os.getenv("ASSETS_PATH", BASE_DIR.parent / "assets"))
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

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
        print(f"[preview] request_id={request_id}")
        return orchestrator.handle_preview(req)
    except Exception as e:
        print(f"[preview] request_id={request_id} error={e}")
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
        print(f"[generate] request_id={request_id}")
        return orchestrator.handle_generate(req, assets_dir=str(ASSETS_DIR))
    except Exception as e:
        print(f"[generate] request_id={request_id} error={e}")
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
            import traceback
            print(f"[generate_async] job_id={job_id} error={e}")
            print(f"[generate_async] traceback:\n{traceback.format_exc()}")
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


