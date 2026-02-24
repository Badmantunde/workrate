-- Migration: studio_name, is_admin, suspended
-- Run: psql -d workrate -f workrate-api/sql/migrate-studio-admin.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS studio_name TEXT,
  ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended   BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.studio_name IS 'Studio or agency name when user acts as client/hiring.';
COMMENT ON COLUMN users.is_admin IS 'If true, user can access admin API and admin app.';
COMMENT ON COLUMN users.suspended IS 'If true, user cannot log in; set by admin.';
