-- WorkRate Database Schema
-- Run once: psql -d workrate -f sql/schema.sql

-- ── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fast text search on sessions

-- ── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,                          -- null if Google OAuth only
  name          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'free'   -- free | pro | agency
                CHECK (plan IN ('free','pro','agency')),
  hourly_rate   NUMERIC(10,2) DEFAULT 95,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Refresh tokens ────────────────────────────────────────────────────────
-- One row per active device/session. Revoked by deleting the row.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,            -- bcrypt hash of the raw token
  device_hint TEXT,                           -- "Chrome Extension" | "Web"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ                     -- null = still valid
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ── Clients ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  logo_url   TEXT,
  rate       NUMERIC(10,2),                   -- client-specific override rate
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);

-- ── Sessions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id                 BIGINT,            -- extension's Date.now() id for dedup
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id                UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name              TEXT,              -- denormalised for display without JOIN

  -- Metadata
  task                     TEXT NOT NULL DEFAULT '',
  tags                     TEXT[]  NOT NULL DEFAULT '{}',
  notes                    TEXT,
  session_start            TIMESTAMPTZ NOT NULL,
  session_end              TIMESTAMPTZ NOT NULL,

  -- Time accounting (v1.2 model)
  wall_sec                 INTEGER NOT NULL DEFAULT 0,
  verified_sec             INTEGER NOT NULL DEFAULT 0,
  off_tab_sec              INTEGER NOT NULL DEFAULT 0,
  idle_sec                 INTEGER NOT NULL DEFAULT 0,
  verified_pct             SMALLINT NOT NULL DEFAULT 0,
  off_tab_pct              SMALLINT NOT NULL DEFAULT 0,
  idle_pct                 SMALLINT NOT NULL DEFAULT 0,
  focus_pct                SMALLINT NOT NULL DEFAULT 0,

  -- Quality
  wqi                      SMALLINT NOT NULL DEFAULT 0,
  registered_tab_switches  SMALLINT NOT NULL DEFAULT 0,
  unregistered_tab_switches SMALLINT NOT NULL DEFAULT 0,

  -- Evidence (JSONB — flexible for future extension)
  registered_tabs          JSONB NOT NULL DEFAULT '[]',
  off_tab_events           JSONB NOT NULL DEFAULT '[]',
  activity_blocks          JSONB NOT NULL DEFAULT '[]',
  adjustments              JSONB NOT NULL DEFAULT '[]',

  -- Client visibility
  shared                   BOOLEAN NOT NULL DEFAULT FALSE,
  approved                 BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at              TIMESTAMPTZ,
  approved_by              UUID REFERENCES users(id),
  rejected                 BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason         TEXT,

  -- Sync
  synced_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate uploads from extension
  UNIQUE(user_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user      ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client    ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start     ON sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_shared    ON sessions(user_id, shared) WHERE shared = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_task_trgm ON sessions USING GIN(task gin_trgm_ops);

-- ── Milestones ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  due_date    DATE,
  budget_usd  NUMERIC(10,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
