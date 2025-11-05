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

### Environment Variables
- `ALLOWED_ORIGIN` – frontend origin for CORS (e.g., http://localhost:5173)
- `GOOGLE_GENAI_API_KEY` – Google AI API key for image generation
- `OPENAI_API_KEY` – OpenAI API key for LLM agent
- `ASSETS_PATH` – (Optional) Path to assets directory (default: `./assets`)
- `LOG_LEVEL` – info|debug (optional)

### Railway Deployment
For production on Railway, you need **persistent storage** for generated files:

1. **Create a Volume** in Railway dashboard
   - Mount Path: `/app/assets`
   - Size: 1 GB (increase as needed)

2. **Set Environment Variable**:
   ```
   ASSETS_PATH=/app/assets
   ```

See [RAILWAY_VOLUMES.md](./RAILWAY_VOLUMES.md) for detailed setup instructions.

## Notes
- Image generation uses Gemini for production; falls back to placeholders if no API key
- Assets are exposed at `/assets/*` endpoint
- Local dev uses `./assets/` directory (no volume needed)

