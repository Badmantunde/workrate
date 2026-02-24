/**
 * Generate Admin SQL Script
 * Run: node scripts/generate-admin-sql.js
 * Outputs SQL with correct bcrypt hash for Admin1234
 */
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = 'Admin@workrate.com';
const ADMIN_PASSWORD = 'Admin1234';
const ADMIN_NAME = 'Admin';

async function generateSQL() {
  try {
    console.log('Generating password hash...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    console.log('\n--- SQL to run in PostgreSQL ---\n');
    console.log(`-- Setup admin user: ${ADMIN_EMAIL}`);
    console.log(`-- Password: ${ADMIN_PASSWORD}\n`);
    
    console.log(`-- Update or insert admin user`);
    console.log(`INSERT INTO users (email, password_hash, name, plan, is_admin, suspended)`);
    console.log(`SELECT`);
    console.log(`  '${ADMIN_EMAIL.toLowerCase()}',`);
    console.log(`  '${passwordHash}',`);
    console.log(`  '${ADMIN_NAME}',`);
    console.log(`  'agency',`);
    console.log(`  true,`);
    console.log(`  false`);
    console.log(`WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER('${ADMIN_EMAIL}'));`);
    console.log(`\nUPDATE users`);
    console.log(`SET`);
    console.log(`  password_hash = '${passwordHash}',`);
    console.log(`  name = '${ADMIN_NAME}',`);
    console.log(`  plan = 'agency',`);
    console.log(`  is_admin = true,`);
    console.log(`  suspended = false`);
    console.log(`WHERE LOWER(email) = LOWER('${ADMIN_EMAIL}');`);
    
    console.log('\n--- End SQL ---\n');
    console.log('Copy the SQL above and run it in your PostgreSQL database.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

generateSQL();
