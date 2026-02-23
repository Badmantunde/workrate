# WorkRate API

Node.js + PostgreSQL backend for WorkRate. Handles auth, session sync from the Chrome Extension, and the data layer for the dashboard.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your values
cp .env.example .env

# 3. Create the database
createdb workrate

# 4. Run migrations (creates all tables)
npm run migrate

# 5. Seed a demo user (optional)
npm run seed

# 6. Start dev server (auto-restarts on save)
npm run dev
```

Server starts at **http://localhost:3001**

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✓ | 64-byte hex secret for access tokens |
| `JWT_REFRESH_SECRET` | ✓ | 64-byte hex secret for refresh tokens |
| `PORT` | — | HTTP port (default: 3001) |
| `NODE_ENV` | — | `development` or `production` |
| `ALLOWED_ORIGINS` | ✓ | Comma-separated CORS origins |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## API reference

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ email, password, name }` | Create account |
| `POST` | `/api/auth/login` | `{ email, password, device? }` | Get tokens |
| `POST` | `/api/auth/refresh` | `{ refreshToken }` | Rotate token pair |
| `POST` | `/api/auth/logout` | — | Revoke all tokens |
| `GET`  | `/api/auth/me` | — | Current user |
| `PATCH`| `/api/auth/me` | `{ name?, hourly_rate?, timezone? }` | Update profile |

All protected routes require: `Authorization: Bearer <accessToken>`

### Sessions

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions/sync` | Upload one session from extension |
| `POST` | `/api/sessions/sync/batch` | Upload up to 100 queued sessions |
| `GET`  | `/api/sessions` | List sessions (filters: `client`, `date`, `q`, `limit`, `offset`) |
| `GET`  | `/api/sessions/stats` | Aggregates for dashboard widgets |
| `GET`  | `/api/sessions/:id` | Single session |
| `PATCH`| `/api/sessions/:id` | Update (share, adjust time, notes, tags) |
| `POST` | `/api/sessions/:id/approve` | Mark session approved |
| `POST` | `/api/sessions/:id/reject` | Mark session rejected + reason |
| `DELETE`| `/api/sessions/:id` | Delete session |

### Clients

| Method | Path | Description |
|---|---|---|
| `GET`  | `/api/clients` | List clients with session aggregates |
| `POST` | `/api/clients` | Create client |
| `GET`  | `/api/clients/:id` | Client detail + recent sessions |
| `PATCH`| `/api/clients/:id` | Update client |
| `DELETE`| `/api/clients/:id` | Delete client |

### Health

`GET /health` — returns `{ status: "ok", version, env, ts }`

---

## Session sync (extension → API)

The extension calls `POST /api/sessions/sync` immediately when a session stops. If offline or not logged in, sessions are queued in `chrome.storage.local` and uploaded the next time the extension has a valid token and network access.

The sync is **idempotent**: re-uploading the same session (identified by `user_id + local_id`) is safe — the server acknowledges it without creating a duplicate.

**Session fields sent by extension:**

```json
{
  "id": 1706123456789,
  "task": "Dashboard UI Redesign",
  "client": "Volta Studio",
  "tags": ["Design", "React"],
  "sessionStart": "2026-02-23T09:12:00.000Z",
  "sessionEnd":   "2026-02-23T12:47:00.000Z",
  "verifiedSec": 12900,
  "offTabSec": 900,
  "idleSec": 600,
  "verifiedPct": 90,
  "offTabPct": 6,
  "idlePct": 4,
  "wqi": 87,
  "registeredTabs": [{ "domain": "figma.com", "title": "Dashboard v3" }],
  "offTabEvents": [{ "domain": "gmail.com", "durationSec": 240 }],
  "activityBlocks": []
}
```

---

## Token flow

```
Extension / Dashboard
  │
  ├─ POST /api/auth/login
  │       → { accessToken (15m), refreshToken (30d) }
  │
  ├─ Every request: Authorization: Bearer <accessToken>
  │
  └─ When 401 received:
       POST /api/auth/refresh  { refreshToken }
       → { accessToken, refreshToken }   ← old refresh token revoked
       Retry original request
```

Refresh tokens rotate on every use (single-use). If a refresh token is used twice, it indicates theft — revoke all user tokens.

---

## Database schema

See `sql/schema.sql` for the full schema. Key tables:

- **users** — accounts, plan, hourly rate
- **refresh_tokens** — bcrypt-hashed, single-use, expire after 30 days
- **clients** — per-user client list, auto-created from session `client` field
- **sessions** — the core table; JSONB columns for `registered_tabs`, `off_tab_events`, `activity_blocks`
- **milestones** — project milestones linked to clients

---

## Deployment

The API is a standard Node.js HTTP server. Works on:

- **Railway / Render / Fly.io** — push to git, set env vars, done
- **VPS (Ubuntu)** — run with PM2: `pm2 start src/index.js --name workrate-api`
- **Docker** — Dockerfile not included yet; standard Node 18 Alpine image works

Set `NODE_ENV=production` and `DATABASE_URL` to your managed Postgres (Railway, Supabase, Neon, or RDS all work).

---

## Project structure

```
workrate-api/
├── package.json
├── .env.example
├── sql/
│   └── schema.sql          ← run once to create tables
└── src/
    ├── index.js             ← Express app, middleware, route mounting
    ├── db/
    │   ├── pool.js          ← pg connection pool + query helper
    │   ├── migrate.js       ← npm run migrate
    │   └── seed.js          ← npm run seed (dev only)
    ├── middleware/
    │   └── auth.js          ← requireAuth / optionalAuth JWT middleware
    ├── services/
    │   └── tokens.js        ← issue / rotate / revoke JWT + refresh tokens
    └── routes/
        ├── auth.js          ← register, login, refresh, logout, me
        ├── sessions.js      ← sync, list, stats, approve, reject
        └── clients.js       ← CRUD
```
