# Portfolio Work Section & AI Toolbox — Quick Setup Guide

## 1. Recommended 100% Free Cloud Storage Strategy
- **Photos & 3D Files (`100+ files/project`)**: Upload each project folder (`project-1`, `project-2`, etc.) to **Google Drive** (15 GB free per account; create extra free accounts anytime) and set folder sharing to **Anyone with the link → Viewer**.
- **Walkthrough Videos (`raw MP4/4K`)**: Upload to **YouTube** as **Unlisted** (or Public) for **unlimited lifetime free 4K/60fps streaming** with zero lag. Facebook video/post links are also supported natively.
- **Optional Unlimited Free Storage**: If you want unlimited raw image/video storage via a private Telegram channel, deploy `workers/telegram-proxy.js` on **Cloudflare Workers** (free tier: 100,000 requests/day) with your Bot Token saved as a secret (`TG_BOT_TOKEN`).

## 2. One-Time Free Setup (5 Minutes, Zero API Keys in GitHub)

### Step A — Upload Updated Site to GitHub Pages
1. Extract `Akash_portfolio_updated.zip` and push/upload all files to your GitHub Pages repository.
2. Your live Toolbox will be available on **both PC and Mobile** at:
   `https://<your-username>.github.io/<your-repo>/toolbox/`

### Step B — Create a Fine-Grained GitHub Token (Zero Repo Leaks)
1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Select **Only select repositories** → pick your portfolio repo.
3. Under **Repository permissions**, set **Contents** to **Read and write**.
4. Copy the token and paste it into **Toolbox → Connect & AI Setup** (it is saved strictly in your browser's `localStorage` and **never** stored in GitHub).

### Step C — Deploy the Free Google Drive Folder Scanner (No API Key!)
1. Go to `https://script.google.com` → **New Project**.
2. Copy & paste the entire code from `workers/drive-folder-scanner.gs`.
3. Click **Deploy → New deployment → Web app** → Execute as **Me**, Who has access **Anyone**.
4. Copy the `/exec` URL and paste it into **Toolbox → Connect & AI Setup → Drive Scanner URL**.

### Step D — Choose Your Free AI Mode (Optional)
- **Built-in Smart Classifier**: Works immediately with zero keys.
- **Google Gemini Free Tier** (best accuracy): Get a free key from `https://aistudio.google.com/apikey` and paste it into **Toolbox → Connect & AI Setup** (saved only in your browser).
- **Local AI (Ollama on PC)**: Select `Local AI on PC (Ollama)` if you run Ollama locally (`http://localhost:11434`).

### Step E — Sync PC & Mobile in 5 Seconds
After saving settings on PC, click **Copy Sync Code for Mobile/PC**, open `/toolbox/` on your phone, and tap **Import Sync Code**.

## 3. Daily Workflow (Adding / Editing Projects, Models & Studio)
1. Open `/toolbox/` on PC or mobile.
2. Paste your Google Drive project folder link, YouTube link(s) (add `[both]` after a link if one video covers both Exterior & Interior), and Facebook link/text.
3. Tap **Scan & AI Auto-Sort into 4 Parts**. Answer any quick clarification questions if the AI couldn't detect a detail or file type.
4. Tap **Push Live to GitHub Pages** — your existing projects are preserved, only tiny JSON files are updated, and your live website updates in ~30–60 seconds.
