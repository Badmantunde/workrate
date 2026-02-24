-- Direct SQL setup for admin user
-- Password hash for 'Admin1234' (bcrypt, rounds=12)
-- Run: psql -d workrate -f sql/setup-admin-direct.sql
-- Or manually: UPDATE/INSERT with the hash below

-- First, generate the hash using Node.js:
-- const bcrypt = require('bcryptjs');
-- bcrypt.hash('Admin1234', 12).then(console.log);

-- For now, use this placeholder approach:
-- You'll need to run the Node.js script to get the actual hash, or use:
-- UPDATE users SET password_hash = '<hash>', is_admin = true WHERE email = 'Admin@workrate.com';

-- Or create if doesn't exist:
INSERT INTO users (email, password_hash, name, plan, is_admin, suspended)
SELECT 
  'Admin@workrate.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5', -- PLACEHOLDER - replace with actual hash
  'Admin',
  'agency',
  true,
  false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER('Admin@workrate.com'));

-- Update if exists:
UPDATE users 
SET 
  password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5', -- PLACEHOLDER
  name = 'Admin',
  plan = 'agency',
  is_admin = true,
  suspended = false
WHERE LOWER(email) = LOWER('Admin@workrate.com');

-- Note: The password hash above is a placeholder. 
-- You MUST run the Node.js script to generate the correct hash, or manually hash 'Admin1234' with bcrypt.
