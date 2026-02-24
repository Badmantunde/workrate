/**
 * WorkRate — Auth Routes
 * POST /api/auth/register   — create account
 * POST /api/auth/login      — get access + refresh token
 * POST /api/auth/refresh    — swap refresh token for new pair
 * POST /api/auth/logout     — revoke all tokens for this user
 * GET  /api/auth/me         — current user info
 */
import { Router }   from 'express';
import bcrypt       from 'bcryptjs';
import { query }    from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '../services/tokens.js';

const router = Router();

/* ── POST /api/auth/register ─────────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, plan, hourly_rate, created_at`,
      [email.toLowerCase(), hash, name || '']
    );

    const user = rows[0];
    
    // Auto-create Client and Freelancer profiles for new user
    await query(
      `INSERT INTO clients (user_id, name, email) VALUES ($1, $2, $3), ($1, $4, $3)
       ON CONFLICT DO NOTHING`,
      [user.id, 'Client', email.toLowerCase(), 'Freelancer']
    );

    const accessToken  = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, 'Web');

    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    console.error('[auth/register]', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/* ── POST /api/auth/login ────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password, device } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { rows } = await query(
      `SELECT id, email, name, plan, hourly_rate, password_hash, suspended FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    if (user.suspended) return res.status(403).json({ error: 'Account suspended. Contact support.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const deviceHint   = device || 'Web';
    const accessToken  = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, deviceHint);

    // Remove password_hash before sending
    delete user.password_hash;
    return res.json({ user, accessToken, refreshToken });
  } catch (err) {
    console.error('[auth/login]', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/* ── POST /api/auth/refresh ─────────────────────────────────────────── */
// Called by extension and dashboard when the access token expires.
// Sends: { refreshToken: "raw-uuid-token" }
// Returns: { accessToken, refreshToken, user }
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const result = await rotateRefreshToken(refreshToken);
    return res.json(result);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
});

/* ── POST /api/auth/logout ──────────────────────────────────────────── */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await revokeAllUserTokens(req.user.id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

/* ── GET /api/auth/me ───────────────────────────────────────────────── */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, name, plan, hourly_rate, avatar_url, timezone, studio_name, github_url, linkedin_url, twitter_url, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/* ── PATCH /api/auth/me ─────────────────────────────────────────────── */
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, hourly_rate, timezone, avatar_url, studio_name, github_url, linkedin_url, twitter_url } = req.body;
    const updates = [
      'name = COALESCE($1, name)',
      'hourly_rate = COALESCE($2, hourly_rate)',
      'timezone = COALESCE($3, timezone)',
    ];
    const params = [name, hourly_rate, timezone];
    let idx = 4;
    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar_url')) {
      updates.push(`avatar_url = $${idx}`);
      params.push(avatar_url);
      idx++;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'studio_name')) {
      updates.push(`studio_name = $${idx}`);
      params.push(studio_name);
      idx++;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'github_url')) {
      updates.push(`github_url = $${idx}`);
      params.push(github_url);
      idx++;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'linkedin_url')) {
      updates.push(`linkedin_url = $${idx}`);
      params.push(linkedin_url);
      idx++;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'twitter_url')) {
      updates.push(`twitter_url = $${idx}`);
      params.push(twitter_url);
      idx++;
    }
    params.push(req.user.id);
    const { rows } = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, email, name, plan, hourly_rate, timezone, avatar_url, studio_name, github_url, linkedin_url, twitter_url`,
      params
    );
    return res.json({ user: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
