# Railway Volumes Configuration

## What is a Railway Volume?

A Railway Volume provides **persistent storage** that survives deployments and restarts. Without it, any files saved to the filesystem (like generated images and PDFs) would be lost when Railway redeploys your service.

## Setup Instructions

### 1. Create Volume in Railway Dashboard

After deploying your backend to Railway:

1. Go to your Railway project
2. Click on your service (backend)
3. Go to the **"Volumes"** tab
4. Click **"New Volume"**
5. Configure:
   - **Mount Path**: `/app/assets`
   - **Name**: `assets-storage` (or any name you prefer)
   - **Size**: Start with **1 GB** (can increase later)

### 2. Set Environment Variable

Railway will automatically mount the volume at `/app/assets`. To use it, add this environment variable:

**In Railway Dashboard → Variables:**
```
ASSETS_PATH=/app/assets
```

This tells the backend to save files to the persistent volume instead of ephemeral storage.

### 3. Restart Service

After adding the volume and environment variable:
1. Railway will automatically redeploy
2. Check logs to verify: `Assets directory: /app/assets`

---

## Verification

After deployment, test that files persist:

```bash
# Generate a board
curl -X POST https://your-railway-url.railway.app/api/boards/generate/start \
  -H "Content-Type: application/json" \
  -d '{...}'

# Check if image is accessible
curl https://your-railway-url.railway.app/assets/img_XXXXX.png

# Trigger a redeploy in Railway
# Then check if the image is still accessible (it should be!)
```

---

## File Structure on Volume

```
/app/assets/
├── img_abc123.png        # Generated images
├── img_def456.png
├── board_xyz789.png      # Board renders
├── board_xyz789.pdf      # Board PDFs
└── ...
```

---

## Storage Limits & Pricing

**Railway Volumes:**
- **Hobby Plan**: 5 GB included free
- **Pro Plan**: 100 GB included free
- **Additional storage**: $0.25/GB/month

**Estimated Usage:**
- Average image: ~1 MB
- Average board PNG: ~500 KB
- Average board PDF: ~200 KB
- **1 GB** ≈ 600-800 boards

---

## Cleanup Strategy (Future)

Since volumes cost money, consider implementing cleanup:

1. **Auto-delete old files** (e.g., > 30 days)
2. **Implement user-owned storage** (users manage their boards)
3. **Migrate to S3/R2** for cheaper long-term storage

For now, 1-5 GB should be plenty for MVP/testing.

---

## Local Development

Local dev continues to use `./assets/` directory (no volume needed).

The `ASSETS_PATH` environment variable is only set in Railway:
- **Local**: Uses `./assets/` (default)
- **Railway**: Uses `/app/assets` (volume mount)

---

## Troubleshooting

### Files disappear after deployment
- ✅ Check that volume is mounted at `/app/assets`
- ✅ Check that `ASSETS_PATH=/app/assets` is set
- ✅ Check Railway logs for "Assets directory: /app/assets"

### Volume full
- Check current usage in Railway dashboard
- Increase volume size
- Implement cleanup strategy

### Permission errors
- Railway volumes are writable by default
- Check logs for specific error messages

