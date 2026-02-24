/**
 * Setup Admin User Script
 * Run: node scripts/setup-admin.js
 * Creates/updates admin user with standardized credentials
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

const ADMIN_EMAIL = 'Admin@workrate.com';
const ADMIN_PASSWORD = 'Admin1234';
const ADMIN_NAME = 'Admin';

async function setupAdmin() {
  try {
    console.log('Setting up admin user...');
    console.log('Connecting to database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('ERROR: DATABASE_URL not found in environment variables.');
      console.error('Please set DATABASE_URL in your .env file or environment.');
      process.exit(1);
    }
    
    // Generate password hash
    console.log('Generating password hash...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    // Check if admin exists
    console.log('Checking for existing admin user...');
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [ADMIN_EMAIL]
    );
    
    if (existing.length > 0) {
      // Update existing admin
      console.log('Updating existing admin user...');
      await query(
        `UPDATE users SET 
          password_hash = $1,
          name = $2,
          plan = 'agency',
          is_admin = true,
          suspended = false
         WHERE LOWER(email) = LOWER($3)`,
        [passwordHash, ADMIN_NAME, ADMIN_EMAIL]
      );
      console.log(`✓ Admin user updated: ${ADMIN_EMAIL}`);
    } else {
      // Create new admin
      console.log('Creating new admin user...');
      await query(
        `INSERT INTO users (email, password_hash, name, plan, is_admin, suspended)
         VALUES ($1, $2, $3, 'agency', true, false)`,
        [ADMIN_EMAIL.toLowerCase(), passwordHash, ADMIN_NAME]
      );
      console.log(`✓ Admin user created: ${ADMIN_EMAIL}`);
    }
    
    console.log(`\nAdmin credentials:`);
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`\n✓ Setup complete!`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error setting up admin:');
    console.error(err.message);
    if (err.stack) console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

setupAdmin();
