# Schneider CFI Backend (FastAPI)

Minimal backend to power the agent-guided board creation flow.

## Endpoints
- POST `/api/boards/preview` – parse description, validate profile/layout, return summary
- POST `/api/boards/generate` – generate placeholder images, assemble board PNG/PDF, return URLs
- GET `/healthz` – health check
- GET `/assets/*` – served generated assets (ephemeral)

## Local run (uv)
```bash
# Install uv (macOS): brew install uv
# Or: curl -LsSf https://astral.sh/uv/install.sh | sh && export PATH="$HOME/.local/bin:$PATH"

uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Configuration
- `ALLOWED_ORIGIN` – frontend origin for CORS (e.g., http://localhost:5173)
- `LOG_LEVEL` – info|debug (optional)

## Notes
- Image generation uses local placeholders (Pillow) for MVP; swap `ImageGeneratorTool` with a provider later.
- Assets are written under `backend/assets/` and exposed at `/assets/*`.

