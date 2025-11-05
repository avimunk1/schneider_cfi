# 🚀 Deployment Ready Checklist

## ✅ All Pre-Deployment Checks Passed

### Code Changes
- ✅ Frontend builds successfully (3.96s)
- ✅ Backend API working locally
- ✅ TypeScript errors fixed
- ✅ Railway Volumes configured
- ✅ Environment variable support added

### Files Created/Modified
**New Files:**
1. `backend/railway.toml` - Railway build config
2. `backend/RAILWAY_VOLUMES.md` - Volume setup guide
3. `vercel.json` - Vercel SPA routing
4. `.vercelignore` - Backend exclusion
5. `PRE_DEPLOYMENT_SUMMARY.md` - Test results
6. `PRE_DEPLOYMENT_TEST.md` - Test checklist

**Modified Files:**
1. `backend/app/main.py` - Added ASSETS_PATH env variable support
2. `backend/README.md` - Added deployment documentation
3. `src/lib/api.ts` - Environment-based API URL
4. `env.example` - Complete deployment guide
5. `PRE_DEPLOYMENT_SUMMARY.md` - Added volume setup steps

---

## 🎯 Deployment Steps

### Phase 1: Pause Vercel (2 minutes)
**Action Required:** Manual step in Vercel dashboard

1. Go to: https://vercel.com/avimunk1s-projects/schneider_cfi/settings/git
2. Find "Pause Deployments" toggle
3. Turn it **ON** ✅
4. Confirm: Deployments are paused

**Why?** Prevents auto-deploy when you push to GitHub.

---

### Phase 2: Push to GitHub (2 minutes)

```bash
cd /Users/avimunk/Curserprojects/schneider_cfi

git add .
git commit -m "feat: production deployment configuration

- Add Railway mono-repo build config (railway.toml)
- Add Vercel SPA routing (vercel.json)
- Configure Railway Volumes for persistent storage
- Update API client for environment-based backend URL
- Add comprehensive deployment documentation
- Fix TypeScript build errors
"

git push origin main
```

**Verify:** Check GitHub that all files are pushed

---

### Phase 3: Deploy Backend to Railway (10 minutes)

#### 3.1 Create Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose: `schneider_cfi` repository
5. Railway will start initial build

#### 3.2 Configure Root Directory
1. Click on the service
2. Go to **Settings**
3. Find "Build" section
4. Set **Root Directory**: `backend`
5. Set **Watch Paths**: `backend/**`
6. Click **Save**

#### 3.3 Add Environment Variables
Go to **Variables** tab, add:

```
GOOGLE_GENAI_API_KEY=<your_google_ai_api_key>
OPENAI_API_KEY=<your_openai_api_key>
ALLOWED_ORIGIN=https://schneider-cfi.vercel.app
ASSETS_PATH=/app/assets
LOG_LEVEL=info
```

#### 3.4 Create Volume
1. Go to **Volumes** tab
2. Click **"New Volume"**
3. Configure:
   - **Mount Path**: `/app/assets`
   - **Size**: `1 GB` (can increase later)
4. Click **Create**

#### 3.5 Deploy
1. Railway will automatically redeploy
2. Wait ~2-3 minutes for build
3. Once deployed, copy the URL (e.g., `https://schneider-backend-production.up.railway.app`)

#### 3.6 Test Deployment
```bash
# Test health endpoint
curl https://your-railway-url.railway.app/healthz

# Should return: {"status":"ok","time":...}
```

---

### Phase 4: Configure Vercel (5 minutes)

#### 4.1 Set Environment Variables
1. Go to: https://vercel.com/avimunk1s-projects/schneider_cfi/settings/environment-variables
2. Add **Production** variable:

```
Name: VITE_API_BASE_URL
Value: https://your-railway-url.railway.app
Environment: Production
```

3. Add second variable:

```
Name: VITE_SHOW_TEST_FEATURES
Value: false
Environment: Production
```

4. Click **Save**

#### 4.2 Resume Deployments
1. Go to: https://vercel.com/avimunk1s-projects/schneider_cfi/settings/git
2. Turn **OFF** the "Pause Deployments" toggle
3. Go to **Deployments** tab
4. Click **"Redeploy"** on the latest deployment
5. Select **"Use existing Build Cache"** (optional)
6. Click **Redeploy**

#### 4.3 Wait for Build
- Build time: ~30-40 seconds
- Watch for "Deployment Ready" status

---

### Phase 5: Test Production (5 minutes)

#### 5.1 Test Existing Demo
**URL:** https://schneider-cfi.vercel.app/

**Expected:** ✅ Works as before (no backend needed)

#### 5.2 Test New Agent Mode
**URL:** https://schneider-cfi.vercel.app/new

**Test Cases:**
1. Page loads ✅
2. Enter board description (e.g., "לוח עם 4 פירות")
3. Preview generates ✅
4. Click "צור לוח" ✅
5. Progress updates show ✅
6. Final board displays ✅
7. PNG download works ✅
8. PDF link works ✅

#### 5.3 Check Browser Console
- No 404 errors on `/api` calls
- API calls go to Railway URL
- CORS headers present

---

## 🔧 Troubleshooting

### Issue: CORS Errors
**Fix:** Update Railway `ALLOWED_ORIGIN` to include all Vercel domains:
```
ALLOWED_ORIGIN=https://schneider-cfi.vercel.app,https://schneider-cfi-git-main-avimunk1s-projects.vercel.app
```

### Issue: Images Return 404
**Fix:** 
1. Check Railway logs for "Assets directory: /app/assets"
2. Verify volume is mounted
3. Verify `ASSETS_PATH=/app/assets` is set

### Issue: "Module not found" in Railway
**Fix:**
1. Verify Root Directory is set to `backend`
2. Check Railway build logs
3. Ensure `requirements.txt` includes all dependencies

---

## 📊 Expected Costs

### Railway (Backend)
- **Hobby Plan**: $5/month
  - Includes: 500 hours, 5GB storage, 100GB bandwidth
  - Enough for: MVP/beta testing

### Vercel (Frontend)
- **Hobby Plan**: Free
  - Includes: 100GB bandwidth, unlimited deployments
  - Enough for: MVP/production

### Total Monthly Cost: **$5**

---

## 📈 Post-Deployment Monitoring

### Week 1: Monitor
- Check Railway logs for errors
- Monitor volume usage (should be < 100 MB initially)
- Test all features thoroughly
- Collect user feedback

### Month 1: Optimize
- Review Railway metrics (CPU, memory, bandwidth)
- Consider cleanup strategy for old files
- Plan for scaling if needed

---

## 🎉 Success Criteria

You'll know deployment is successful when:
- ✅ Demo page works on Vercel
- ✅ `/new` page loads and connects to Railway
- ✅ Can create boards end-to-end
- ✅ Generated files persist across Railway redeploys
- ✅ No console errors
- ✅ Download links work

---

**Estimated Total Time: 20-25 minutes**

Good luck! 🚀

