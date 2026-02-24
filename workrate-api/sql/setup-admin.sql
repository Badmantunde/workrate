-- Setup Admin User
-- Run: psql -d workrate -f sql/setup-admin.sql
-- Or run: npm run setup-admin (requires DATABASE_URL in .env)

-- Admin credentials:
-- Email: Admin@workrate.com
-- Password: Admin1234

-- Insert admin user if doesn't exist
INSERT INTO users (email, password_hash, name, plan, is_admin, suspended)
SELECT
  'admin@workrate.com',
  '$2a$12$IixDyoK8UJFH0dBItXh01e4jiCMBSwShBc0f3qeTrWTba/hRbyePa',
  'Admin',
  'agency',
  true,
  false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER('Admin@workrate.com'));

-- Update admin user if exists
UPDATE users
SET
  password_hash = '$2a$12$IixDyoK8UJFH0dBItXh01e4jiCMBSwShBc0f3qeTrWTba/hRbyePa',
  name = 'Admin',
  plan = 'agency',
  is_admin = true,
  suspended = false
WHERE LOWER(email) = LOWER('Admin@workrate.com');
