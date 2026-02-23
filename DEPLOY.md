# WorkRate — Deployment Guide
## Railway (API) + Netlify (Dashboard + Landing) — Free tier

Total time: ~25 minutes first time.

---

## Overview

```
workrate.netlify.app/           → Landing page
workrate.netlify.app/dashboard  → React dashboard
workrate-api.railway.app/api    → Backend API + PostgreSQL
Chrome Extension (local)        → Points to both above
```

---

## Step 1 — Push to GitHub (required by both platforms)

Both Railway and Netlify deploy from a Git repo.

```bash
# In the folder that contains workrate-api/, workrate-dashboard/, etc.
git init
git add .
git commit -m "Initial WorkRate deployment"

# Create a new repo at github.com (click + → New repository)
# Name it: workrate  (or anything you like)
# Then:
git remote add origin https://github.com/YOUR_USERNAME/workrate.git
git push -u origin main
```

---

## Step 2 — Deploy the API on Railway

### 2a. Create Railway account
Go to **railway.app** → sign up with GitHub (free, no credit card needed).

### 2b. Create a new project
1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your `workrate` repo
4. Select the `workrate-api` folder as the **root directory**
   - In Railway: Settings → Source → Root Directory → `workrate-api`

### 2c. Add PostgreSQL
1. In your Railway project, click **+ New**
2. Select **Database → PostgreSQL**
3. Railway automatically sets `DATABASE_URL` in your service's environment

### 2d. Set environment variables
In Railway → your API service → **Variables** tab, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | *(run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)* |
| `JWT_REFRESH_SECRET` | *(run the same command again — use a different value)* |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `30d` |
| `ALLOWED_ORIGINS` | `https://workrate.netlify.app` *(update after Netlify deploy)* |

`DATABASE_URL` is set automatically by Railway — don't touch it.

### 2e. Deploy
Railway deploys automatically when you push. The `railway.json` config tells it to:
1. Run `npm run migrate` (creates database tables)
2. Run `npm start`

### 2f. Get your Railway URL
In Railway → your service → **Settings** → copy the public URL.
It will look like: `https://workrate-api-production.railway.app`

**Save this URL — you need it in steps 3 and 4.**

### 2g. Test the API is live
```bash
curl https://your-api.railway.app/health
# Should return: {"status":"ok","version":"1.0.0",...}
```

---

## Step 3 — Deploy Dashboard + Landing on Netlify

### 3a. Create Netlify account
Go to **netlify.com** → sign up with GitHub (free).

### 3b. Import your repo
1. Click **Add new site → Import an existing project**
2. Connect GitHub → select your `workrate` repo

### 3c. Configure build settings
In the Netlify UI:

| Setting | Value |
|---|---|
| **Base directory** | *(leave empty — build.sh handles it)* |
| **Build command** | `sh workrate-netlify/build.sh` |
| **Publish directory** | `workrate-dashboard/dist` |

### 3d. Set environment variables
In Netlify → Site → **Environment variables**, add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-api.railway.app` *(from Step 2f)* |

### 3e. Deploy
Click **Deploy site**. Netlify will:
1. Run `sh workrate-netlify/build.sh` (builds React, copies landing page)
2. Serve everything from `workrate-dashboard/dist/`

### 3f. Get your Netlify URL
Netlify gives you `https://random-name-123.netlify.app`.

**Rename it:** Site → Settings → Domain management → Options → Edit site name → type `workrate`
→ You get `https://workrate.netlify.app`

---

## Step 4 — Update URLs after deploy

### 4a. Update Railway ALLOWED_ORIGINS
In Railway → Variables → update `ALLOWED_ORIGINS`:
```
https://workrate.netlify.app,chrome-extension://YOUR_EXTENSION_ID
```
Redeploy (push any change or click Redeploy in Railway).

### 4b. Update the Chrome extension
Edit `workrate-extension/background/api.js`:
```js
const API_BASE = 'https://your-api.railway.app/api';
```

Edit `workrate-extension/popup/popup.js`:
```js
const DASHBOARD_URL = 'https://workrate.netlify.app/dashboard';
```

Push to GitHub. Netlify redeploys automatically.
Reload the extension in Chrome (`chrome://extensions` → reload).

---

## Step 5 — Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `workrate-extension` folder
5. The WorkRate icon appears in your toolbar

---

## Step 6 — Create your account and test end-to-end

1. Open `https://workrate.netlify.app/dashboard`
2. Click **Sign up free** → create an account
3. Open the Chrome extension → go to Settings → log in with the same credentials
4. Start a session in the extension, work for a minute, stop it
5. Refresh the dashboard — your session should appear ✓

---

## Troubleshooting

**Sessions not appearing in dashboard:**
- Check browser console for CORS errors
- Verify `VITE_API_URL` in Netlify matches your Railway URL exactly (no trailing slash)
- Check Railway logs: Railway → your service → **Logs** tab

**"Token expired" immediately:**
- Regenerate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in Railway — they may have been set incorrectly

**Extension can't reach API:**
- Check `API_BASE` in `background/api.js`
- Chrome extensions can fetch any HTTPS URL — HTTP won't work in a published extension
- Railway free tier uses HTTPS by default ✓

**Database migration failed:**
- Check Railway logs for SQL errors
- If schema already exists from a previous deploy, migrations are safe to re-run (all use `IF NOT EXISTS`)

---

## What each platform's free tier gives you

| Platform | Free limit | Notes |
|---|---|---|
| Railway | $5/month credit | ~500 hours of a small Node service + PostgreSQL — enough for testing |
| Netlify | 100GB bandwidth/month, 300 build minutes | More than enough for a prototype |
| Chrome Extension | Free to sideload | Chrome Web Store publish costs $5 one-time |

---

## Going to production (when ready)

1. **Custom domain:** Add `workrate.io` in Netlify → Domain settings (free SSL included)
2. **Railway Pro:** $20/month removes the credit limit
3. **Extension:** Publish to Chrome Web Store ($5 one-time developer fee)
4. **Database backups:** Railway Pro includes automated PostgreSQL backups
