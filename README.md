# Apply — Job Application Tracker

AI-powered job tracker with Google Drive integration. Tailors your CV and generates cover letters for each role, then saves them directly to a Google Drive folder.

---

## Quick Setup (5 minutes)

### 1. Get your Anthropic API Key
1. Go to https://console.anthropic.com
2. API Keys → Create Key
3. Copy it into `config.js` → `ANTHROPIC_API_KEY`

---

### 2. Set up Google OAuth (for Drive saving)

**a) Create a Google Cloud project**
1. Go to https://console.cloud.google.com
2. Click the project dropdown → **New Project** → give it a name → Create

**b) Enable the Google Drive API**
1. In your project: **APIs & Services** → **Library**
2. Search "Google Drive API" → Enable it

**c) Configure the OAuth consent screen**
1. **APIs & Services** → **OAuth consent screen**
2. Choose **External** → Create
3. Fill in App name (e.g. "Apply"), your email, developer email → Save
4. Scopes: click **Add or Remove Scopes** → add `.../auth/drive.file` → Save
5. Test users: add your own Gmail address → Save

**d) Create OAuth credentials**
1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: e.g. "Apply Web"
4. **Authorised JavaScript origins**: add your hosting URL:
   - For local dev: `http://localhost:8080`
   - For GitHub Pages: `https://yourusername.github.io`
5. Click **Create** → copy the **Client ID**
6. Paste it into `config.js` → `GOOGLE_CLIENT_ID`

---

### 3. Run the app

**Option A — Local (simplest)**
```bash
# Python 3
python3 -m http.server 8080
# Then open http://localhost:8080
```

```bash
# Node.js (if you have npx)
npx serve .
```

**Option B — GitHub Pages (free hosting)**
1. Push this folder to a GitHub repo
2. Repo Settings → Pages → Source: main branch, root folder
3. Your app lives at `https://yourusername.github.io/repo-name`
4. Add that URL to your OAuth Authorised JavaScript origins

---

## How it works

1. **My CV** — paste your base CV once
2. **Add job** — paste a job description and set the status
3. Open any job card → click **Tailor CV** or **Cover letter** to generate with AI
4. Click **Save to Google Drive** — files go into a folder called `Apply — Job Applications` in your Drive
5. Update status (Saved → Applied → Interview → Offer / Rejected) as you progress

Files are named: `Company-Name_Job-Title_Tailored-CV.txt` and `Company-Name_Job-Title_Cover-Letter.txt`

---

## Notes
- Your CV and job data are stored in your browser's local storage
- Google Drive access only touches files created by this app (`drive.file` scope — not your entire Drive)
- The Anthropic API is called directly from your browser — your key is only in `config.js` on your machine
