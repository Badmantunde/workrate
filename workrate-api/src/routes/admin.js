/**
 * WorkRate — Admin API (separate app; require is_admin)
 *
 * GET    /api/admin/stats     — platform stats
 * GET    /api/admin/users     — list all users (paginated)
 * PATCH  /api/admin/users/:id — update user (suspended, plan, is_admin)
 */
import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

/* ─── GET /api/admin/stats ───────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const [usersRes, sessionsRes, plansRes] = await Promise.all([
      query(`SELECT COUNT(*)::INT AS total FROM users WHERE suspended = false`),
      query(`SELECT COUNT(*)::INT AS total, COALESCE(SUM(verified_sec),0)::BIGINT AS total_sec FROM sessions`),
      query(`SELECT plan, COUNT(*)::INT AS n FROM users WHERE suspended = false GROUP BY plan`),
    ]);
    const plans = (plansRes.rows || []).reduce((acc, r) => ({ ...acc, [r.plan]: r.n }), {});
    return res.json({
      totalUsers: usersRes.rows[0]?.total ?? 0,
      totalSessions: sessionsRes.rows[0]?.total ?? 0,
      totalVerifiedSec: Number(sessionsRes.rows[0]?.total_sec ?? 0),
      plans: { free: plans.free ?? 0, pro: plans.pro ?? 0, agency: plans.agency ?? 0 },
    });
  } catch (err) {
    console.error('[admin/stats]', err.message);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/* ─── GET /api/admin/users ───────────────────────────────────────────── */
router.get('/users', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.plan, u.suspended, u.is_admin, u.created_at,
              (SELECT COUNT(*)::INT FROM sessions s WHERE s.user_id = u.id) AS session_count,
              (SELECT COALESCE(SUM(verified_sec),0)::BIGINT FROM sessions s WHERE s.user_id = u.id) AS total_verified_sec
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const { rows: countRows } = await query('SELECT COUNT(*)::INT AS total FROM users');
    const total = countRows[0]?.total ?? 0;
    const users = rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      plan: r.plan,
      suspended: r.suspended,
      is_admin: r.is_admin,
      created_at: r.created_at,
      session_count: r.session_count,
      total_verified_sec: Number(r.total_verified_sec ?? 0),
    }));
    return res.json({ users, total, limit, offset });
  } catch (err) {
    console.error('[admin/users]', err.message);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/* ─── PATCH /api/admin/users/:id ─────────────────────────────────────── */
router.patch('/users/:id', async (req, res) => {
  try {
    const { suspended, plan, is_admin } = req.body;
    const updates = [];
    const params = [];
    let i = 1;
    if (typeof suspended === 'boolean') {
      updates.push(`suspended = $${i}`);
      params.push(suspended);
      i++;
    }
    if (plan !== undefined && ['free', 'pro', 'agency'].includes(plan)) {
      updates.push(`plan = $${i}`);
      params.push(plan);
      i++;
    }
    if (typeof is_admin === 'boolean') {
      if (req.params.id === req.user.id && !is_admin) {
        return res.status(400).json({ error: 'Cannot remove your own admin role' });
      }
      updates.push(`is_admin = $${i}`);
      params.push(is_admin);
      i++;
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, name, plan, suspended, is_admin`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('[admin/users patch]', err.message);
    return res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
