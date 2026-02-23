import jwt      from 'jsonwebtoken';
import bcrypt   from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';

/* ─── Access token (short-lived, 15m) ──────────────────────────────────── */

export function issueAccessToken(user) {
  return jwt.sign(
    { email: user.email, plan: user.plan },
    process.env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: process.env.JWT_ACCESS_EXPIRY ?? '15m' }
  );
}

/* ─── Refresh token (long-lived, 30d) ──────────────────────────────────── */

/**
 * issueRefreshToken — creates a new refresh token, stores a hash in DB.
 * Returns the raw token string (sent to client once, never stored raw).
 */
export async function issueRefreshToken(userId, deviceHint = 'Web') {
  const raw       = uuidv4();
  const hash      = await bcrypt.hash(raw, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_hint, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hash, deviceHint, expiresAt]
  );

  return raw;
}

/**
 * rotateRefreshToken — validates the incoming refresh token, revokes it,
 * issues a new access token + new refresh token.
 * Returns { accessToken, refreshToken, user } or throws.
 */
export async function rotateRefreshToken(rawToken) {
  // Fetch all non-expired, non-revoked tokens for comparison
  // (We can't query by hash directly because bcrypt is one-way, so we
  //  fetch recent tokens and compare. In production with many users,
  //  store a fast lookup index separately.)
  const { rows: candidates } = await query(
    `SELECT rt.*, u.email, u.plan, u.name, u.id as user_id
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.revoked_at IS NULL AND rt.expires_at > NOW()
     ORDER BY rt.created_at DESC
     LIMIT 500`
  );

  let matched = null;
  for (const row of candidates) {
    if (await bcrypt.compare(rawToken, row.token_hash)) {
      matched = row;
      break;
    }
  }

  if (!matched) throw new Error('Invalid or expired refresh token');

  // Revoke the used token (rotation — single use)
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [matched.id]
  );

  const user = { id: matched.user_id, email: matched.email, plan: matched.plan };

  const accessToken  = issueAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, matched.device_hint);

  return { accessToken, refreshToken, user };
}

/**
 * revokeAllUserTokens — logs out from all devices.
 */
export async function revokeAllUserTokens(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
