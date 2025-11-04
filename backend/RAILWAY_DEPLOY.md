# Railway Deployment Guide

## Prerequisites
- Railway account: https://railway.app/
- GitHub repository with this backend code

## Steps

### 1. Push backend to GitHub
```bash
cd /Users/avimunk/Curserprojects/schneider_cfi
git add backend/
git commit -m "Add FastAPI backend with uv and Docker"
git push origin main
```

### 2. Create Railway project
- Go to https://railway.app/new
- Click "Deploy from GitHub repo"
- Authorize Railway to access your GitHub
- Select your `schneider_cfi` repository
- Railway will detect the Dockerfile in `backend/`

### 3. Configure service
- Railway auto-detects `backend/Dockerfile` and `railway.json`
- Set **Root Directory**: `backend`
- Build: Dockerfile (auto-detected)

### 4. Set environment variables
In Railway dashboard → Variables, add:
- `ALLOWED_ORIGIN` = your frontend URL (e.g., `https://schneider-cfi.vercel.app` or `http://localhost:5173` for dev)
- `GOOGLE_GENAI_API_KEY` = your Google AI Studio API key (for image generation)
- `LOG_LEVEL` = `info` (optional)

### 5. Deploy
- Click "Deploy"
- Railway builds the Docker image, runs it, and assigns a public URL
- Copy the URL (e.g., `https://schneider-cfi-backend-production.up.railway.app`)

### 6. Update frontend
In your frontend `.env` (or Vercel/Netlify env):
```
VITE_API_BASE_URL=https://YOUR_RAILWAY_URL
```

Rebuild and redeploy frontend.

### 7. Test
- Open your frontend `/new` route
- Agent should POST to Railway backend
- Check Railway logs for requests

## Notes
- Railway provides 500 hours/month free tier
- Ephemeral disk: assets stored in `/tmp` are wiped on restart; for production, use S3 or persistent volume
- CORS: update `ALLOWED_ORIGIN` to match your frontend domain(s)

## Troubleshooting
- Check Railway logs: Dashboard → Deployments → Logs
- Verify `ALLOWED_ORIGIN` matches your frontend exactly (including https/http and no trailing slash)
- Test healthcheck: `curl https://YOUR_RAILWAY_URL/healthz`

