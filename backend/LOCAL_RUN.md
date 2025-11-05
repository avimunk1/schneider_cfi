# Local Development Guide

## Quick Start

### Backend
```bash
cd backend

# Create venv and install dependencies (first time only)
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt

# Run server (loads .env automatically)
source .venv/bin/activate
export $(cat .env | grep -v '^#' | xargs)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
#stop the proces
pkill -f "uvicorn app.main:app"

Backend will run on http://localhost:8000

### Frontend
```bash
cd /Users/avimunk/Curserprojects/schneider_cfi

# Install dependencies (first time only)
npm install

# Run dev server
npm run dev
```
# check if server is runing
ps aux | grep uvicorn
Frontend will run on http://localhost:5173

## Testing the Agent Flow

1. Open http://localhost:5173/new
2. Type a board description in Hebrew, e.g.:
   ```
   תכין לי לוח בנושא פירות עם 8 תמונות ליד בן 8
   ```
3. Agent will parse and show preview
4. Click "צור לוח" to generate
5. Wait ~10-20s for Gemini image generation
6. Download PNG or PDF from links

## Environment Variables

### Backend (.env already configured)
- `ALLOWED_ORIGIN=http://localhost:5173` – CORS
- `GOOGLE_GENAI_API_KEY=...` – Gemini API
- `LOG_LEVEL=info` – Logging level

### Frontend (no .env needed for local dev)
- Vite proxy forwards `/api` to `http://localhost:8000`
- For production, set `VITE_API_BASE_URL=https://your-railway-backend.up.railway.app`

## Existing Demo
- Still available at http://localhost:5173/
- Image-by-image flow unchanged
- Click "מצב סוכן חדש" button to go to /new

## Troubleshooting

### Backend issues
- Check backend is running: `curl http://localhost:8000/healthz`
- Check logs in terminal for errors
- Verify .env file exists in backend/ with GOOGLE_GENAI_API_KEY

### Frontend issues
- Restart dev server after adding new dependencies
- Check browser console for CORS or 404 errors
- Verify backend is running on port 8000

### Gemini errors
- Check API key is valid: https://aistudio.google.com/apikey
- Gemini may fail for certain prompts → fallback to placeholder images
- Rate limits: wait 1 minute and retry

