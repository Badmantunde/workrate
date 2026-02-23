/**
 * WorkRate — Database Migration Runner
 * Run with: npm run migrate
 *
 * Reads sql/schema.sql and executes it.
 * Safe to run repeatedly — all statements use IF NOT EXISTS.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import pool from './pool.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const sql   = readFileSync(join(__dir, '../../sql/schema.sql'), 'utf8');

try {
  console.log('[migrate] Running schema.sql…');
  await pool.query(sql);
  console.log('[migrate] ✓ Done. All tables and indexes created.');
} catch (err) {
  console.error('[migrate] ✗ Failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
