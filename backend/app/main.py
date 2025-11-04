import os
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import schemas
from . import orchestrator


BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR.parent / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

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
    import uuid
    request_id = uuid.uuid4().hex[:8]
    try:
        print(f"[preview] request_id={request_id}")
        return orchestrator.handle_preview(req)
    except Exception as e:
        print(f"[preview] request_id={request_id} error={e}")
        raise HTTPException(status_code=400, detail={"message": str(e), "request_id": request_id})


@app.post("/api/boards/generate", response_model=schemas.GenerateResponse)
def api_generate(req: schemas.GenerateRequest):
    import uuid
    request_id = uuid.uuid4().hex[:8]
    try:
        print(f"[generate] request_id={request_id}")
        return orchestrator.handle_generate(req, assets_dir=str(ASSETS_DIR))
    except Exception as e:
        print(f"[generate] request_id={request_id} error={e}")
        raise HTTPException(status_code=400, detail={"message": str(e), "request_id": request_id})


