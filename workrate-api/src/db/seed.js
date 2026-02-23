/**
 * WorkRate — Dev Seed
 * Run with: npm run seed
 * Creates one demo user. Safe to run repeatedly (upserts).
 */
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import pool, { query } from './pool.js';

const DEMO = {
  email:    'alex@workrate.dev',
  password: 'workrate123',
  name:     'Alex Rivera',
  plan:     'pro',
};

try {
  const hash = await bcrypt.hash(DEMO.password, 10);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, name, plan)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name          = EXCLUDED.name
     RETURNING id, email, name, plan`,
    [DEMO.email, hash, DEMO.name, DEMO.plan]
  );

  const user = rows[0];

  // Seed two clients
  for (const name of ['Volta Studio', 'Melon Co.']) {
    await query(
      `INSERT INTO clients (user_id, name)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user.id, name]
    );
  }

  console.log(`[seed] ✓ Demo user ready:
  email:    ${DEMO.email}
  password: ${DEMO.password}
  id:       ${user.id}
  plan:     ${user.plan}`);
} catch (err) {
  console.error('[seed] ✗', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
