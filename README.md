# WorkRate — Full Deployment Package

## Contents

| Folder/File | What it is |
|---|---|
| `workrate-api/` | Node.js + PostgreSQL backend → deploy to Railway |
| `workrate-dashboard/` | React dashboard (Vite) → deploy to Netlify |
| `workrate-extension/` | Chrome extension → load unpacked in Chrome |
| `workrate-landing.html` | Static landing page → served by Netlify |
| `netlify.toml` | Netlify build config |
| `build.sh` | Netlify build script (builds dashboard + copies landing page) |
| `DEPLOY.md` | **Start here** — full step-by-step deployment guide |

## Quick start

Read `DEPLOY.md`. Estimated time: 25 minutes.

## Local development

```bash
# Terminal 1 — API
cd workrate-api && npm install && cp .env.example .env
# Edit .env with your local PostgreSQL credentials
npm run migrate && npm run dev

# Terminal 2 — Dashboard
cd workrate-dashboard && npm install
cp .env.example .env.local
# .env.local: leave VITE_API_URL empty (Vite proxy handles it)
npm run dev
# Open http://localhost:5173

# Chrome extension
# chrome://extensions → Load unpacked → select workrate-extension/
# In extension Settings, update API_BASE to http://localhost:3001/api
```
