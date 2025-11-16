# Admin Log Downloads - Usage Guide

## Overview

Three secure endpoints are available for product owners to download analytics and feedback data from Railway.

## 📊 Available Downloads

### 1. **Conversation KPIs** (`conversation_kpis.csv`)
Summary metrics for each session:
- Session ID, user name
- Start/end times, duration
- Total requests, first prompt, summary
- Images requested/created
- Error status

### 2. **Detailed Logs** (`conversation_details.ndjson`)
Complete session data in NDJSON format:
- Full conversation history
- LLM outputs and reasoning
- Generated assets (images, PDFs)
- Error details and stack traces
- Timestamps for each event

### 3. **User Feedback** (`user_feedback.csv`)
User ratings and comments:
- Timestamp, session ID
- Star rating (1-5)
- User comments

---

## 🔐 Setup (One-Time)

### Step 1: Set Admin Token in Railway

1. Go to your Railway project
2. Click on backend service
3. Go to **Variables** tab
4. Add new variable:
   ```
   ADMIN_TOKEN=<generate-random-secure-token>
   ```
   
**Generate a secure token:**
```bash
# Option 1: Using openssl
openssl rand -hex 32

# Option 2: Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Option 3: Online generator
# Visit: https://www.uuidgenerator.net/
```

5. Save and redeploy

### Step 2: Save Your Railway Backend URL

Find your backend URL in Railway (e.g., `https://schneider-backend.railway.app`)

---

## 📥 How to Download Files

### Method 1: Browser (Easiest)

Simply visit these URLs in your browser (replace `YOUR_TOKEN` and `YOUR_URL`):

```
https://YOUR_BACKEND_URL/api/admin/logs/kpis?authorization=YOUR_TOKEN
https://YOUR_BACKEND_URL/api/admin/logs/details?authorization=YOUR_TOKEN
https://YOUR_BACKEND_URL/api/admin/logs/feedback?authorization=YOUR_TOKEN
```

The browser will automatically download the files.

### Method 2: curl (Command Line)

```bash
# Set your credentials (do this once per session)
export BACKEND_URL="https://your-backend.railway.app"
export ADMIN_TOKEN="your-admin-token-here"

# Download KPIs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$BACKEND_URL/api/admin/logs/kpis" \
     -o conversation_kpis.csv

# Download detailed logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$BACKEND_URL/api/admin/logs/details" \
     -o conversation_details.ndjson

# Download feedback
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$BACKEND_URL/api/admin/logs/feedback" \
     -o user_feedback.csv
```

### Method 3: Python Script

```python
import requests

BACKEND_URL = "https://your-backend.railway.app"
ADMIN_TOKEN = "your-admin-token-here"

headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

# Download KPIs
response = requests.get(f"{BACKEND_URL}/api/admin/logs/kpis", headers=headers)
with open("conversation_kpis.csv", "wb") as f:
    f.write(response.content)

# Download details
response = requests.get(f"{BACKEND_URL}/api/admin/logs/details", headers=headers)
with open("conversation_details.ndjson", "wb") as f:
    f.write(response.content)

# Download feedback
response = requests.get(f"{BACKEND_URL}/api/admin/logs/feedback", headers=headers)
with open("user_feedback.csv", "wb") as f:
    f.write(response.content)

print("✅ All files downloaded successfully!")
```

---

## 📖 Analyzing the Data

### KPIs CSV (Excel/Google Sheets)
1. Open in Excel or Google Sheets
2. Sort by duration to find longest sessions
3. Filter by `had_error=True` to find problematic sessions
4. Analyze `images_created` vs `images_requested` for success rate

### Details NDJSON (JSON Lines)
Each line is a complete JSON object for one session.

**View in terminal:**
```bash
# Pretty print first session
head -1 conversation_details.ndjson | python3 -m json.tool

# Count total sessions
wc -l conversation_details.ndjson

# Search for errors
grep '"had_error": true' conversation_details.ndjson
```

**Convert to regular JSON:**
```python
import json

sessions = []
with open("conversation_details.ndjson") as f:
    for line in f:
        sessions.append(json.loads(line))

# Now you can analyze as regular Python list
print(f"Total sessions: {len(sessions)}")
```

### Feedback CSV (Excel/Google Sheets)
1. Open in Excel or Google Sheets
2. Calculate average rating
3. Filter for low ratings (≤2) to find issues
4. Read comments for qualitative feedback

---

## 🔒 Security Notes

- ⚠️ **Keep ADMIN_TOKEN secret** - Don't share in Slack/email
- ⚠️ **Don't commit token** to git
- ✅ Use environment variables or password managers
- ✅ Rotate token if compromised (just update in Railway)
- ✅ Check Railway logs for unauthorized access attempts

---

## 🐛 Troubleshooting

### "401 Unauthorized"
- Check that ADMIN_TOKEN is set correctly in Railway
- Verify you're using the correct token
- Try adding `Bearer ` prefix: `Authorization: Bearer YOUR_TOKEN`

### "404 File not found"
- No sessions recorded yet (files are empty)
- Files are created after first session/feedback
- Check Railway logs for file path issues

### "Connection refused"
- Verify backend URL is correct
- Check Railway service is running
- Try visiting `/healthz` endpoint first

---

## 📅 Recommended Download Frequency

- **Weekly**: Download all files for analysis
- **After incidents**: Download immediately to investigate issues
- **Before presentations**: Get latest metrics
- **Monthly**: Archive for long-term trends

---

## 💡 Future Enhancements

Potential improvements:
- [ ] Simple web dashboard for viewing analytics
- [ ] Email reports (daily/weekly summaries)
- [ ] Automated data export to Google Sheets
- [ ] Real-time metrics API
- [ ] Date range filtering for downloads

