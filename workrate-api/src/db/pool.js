import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max:              10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Run a parameterised query.
 * Usage: await query('SELECT * FROM users WHERE id=$1', [userId])
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] ${Date.now() - start}ms — ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

/**
 * Grab a client for transactions.
 * Always release in a finally block.
 * Usage:
 *   const client = await getClient();
 *   try { await client.query('BEGIN'); ... await client.query('COMMIT'); }
 *   catch { await client.query('ROLLBACK'); throw err; }
 *   finally { client.release(); }
 */
export async function getClient() {
  return pool.connect();
}

export default pool;
