/**
 * WorkRate — Admin Password Reset
 * ═════════════════════════════════
 * Generates a new random password for the admin account.
 *
 * Usage:
 *   npm run reset-admin
 *
 * On Railway:
 *   railway run npm run reset-admin
 */

import 'dotenv/config';
import bcrypt  from 'bcryptjs';
import crypto  from 'crypto';
import pool, { query } from '../src/db/pool.js';

const gen   = (n = 18) => crypto.randomBytes(n).toString('base64url');
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;

console.log('\n' + bold('WorkRate Admin Password Reset'));
console.log(dim('─'.repeat(44)));

if (!process.env.DATABASE_URL) {
  console.error(red('\nERROR: DATABASE_URL not found.\n'));
  process.exit(1);
}

try {
  const { rows } = await query(
    `SELECT id, email FROM users WHERE is_admin = TRUE LIMIT 1`
  );

  if (!rows.length) {
    console.error(red('\nNo admin account found. Run npm run setup-admin first.\n'));
    process.exit(1);
  }

  const admin    = rows[0];
  const password = gen(18);
  const hash     = await bcrypt.hash(password, 12);

  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, admin.id]);
  // Revoke all existing sessions
  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`, [admin.id]);

  console.log('\n' + green('✓ Password rotated. All sessions revoked.\n'));
  console.log('┌─────────────────────────────────────────┐');
  console.log('│          NEW ADMIN CREDENTIALS           │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│  Email:    ${bold(admin.email.padEnd(29))} │`);
  console.log(`│  Password: ${bold(password.padEnd(29))} │`);
  console.log('└─────────────────────────────────────────┘\n');

} catch (err) {
  console.error(red('\nERROR: ' + err.message + '\n'));
  process.exit(1);
} finally {
  await pool.end();
}