# Pre-Deployment Testing Checklist

## ✅ Completed Tests

### 1. Frontend Build Test
**Status**: ✅ PASSED  
**Command**: `npm run build`  
**Result**: Build successful (3.96s)
- Output: `dist/` directory created
- No TypeScript errors
- Bundle size: 1.06 MB (219.89 KB gzipped)

---

## 🔄 Remaining Tests

### 2. Local Backend Test (Required)
**Status**: ⏳ PENDING  
**Steps**:
1. Start backend:
   ```bash
   cd backend
   ./start.sh
   ```
2. Verify endpoints:
   ```bash
   curl http://localhost:8000/healthz
   # Should return: {"status":"ok","time":...}
   ```

### 3. Local Frontend Test (Required)
**Status**: ⏳ PENDING  
**Steps**:
1. Start frontend dev server:
   ```bash
   npm run dev
   ```
2. Open: http://localhost:5173
3. Test existing demo (/) - should work
4. Test new agent mode (/new) - should work with backend

### 4. Integration Test (Required)
**Status**: ⏳ PENDING  
**Test Cases**:
- [ ] Demo page loads and works (no backend needed)
- [ ] `/new` page loads
- [ ] Can submit board request to backend
- [ ] Preview generation works
- [ ] Image generation starts
- [ ] Polling shows progress updates
- [ ] Final board displays correctly
- [ ] PNG download works
- [ ] PDF link works

### 5. Docker Build Test (Optional)
**Status**: ⏳ SKIPPED (Docker not running)  
**Note**: Railway will handle this during deployment

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Frontend Build | ✅ PASS | 3.96s, 1.06MB bundle |
| Backend Local | ⏳ TODO | Need to start backend |
| Frontend Local | ⏳ TODO | Need to test with backend |
| Integration | ⏳ TODO | End-to-end flow |
| Docker Build | ⬜ SKIP | Not critical for pre-deploy |

---

## Next Steps After Testing

1. **If all tests pass**:
   - ✅ Pause Vercel deployments
   - ✅ Push to GitHub
   - ✅ Deploy backend to Railway
   - ✅ Configure Vercel env vars
   - ✅ Resume Vercel deployments

2. **If tests fail**:
   - 🔧 Fix issues locally
   - 🔄 Re-run tests
   - 📝 Document any changes needed

