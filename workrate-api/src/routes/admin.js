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
    const { startDate, endDate } = req.query;
    
    // Build date filter for sessions query
    let sessionsQuery = `SELECT COUNT(*)::INT AS total, COALESCE(SUM(verified_sec),0)::BIGINT AS total_sec, COALESCE(SUM(wall_sec),0)::BIGINT AS total_wall_sec FROM sessions s`;
    const sessionsParams = [];
    if (startDate && endDate) {
      sessionsQuery += ` WHERE s.session_start >= $1 AND s.session_start <= $2`;
      sessionsParams.push(startDate, endDate);
    }
    
    const [usersRes, sessionsRes, plansRes, revenueRes] = await Promise.all([
      query(`SELECT COUNT(*)::INT AS total FROM users WHERE suspended = false`),
      query(sessionsQuery, sessionsParams),
      query(`SELECT plan, COUNT(*)::INT AS n FROM users WHERE suspended = false GROUP BY plan`),
      query(`SELECT 
        COUNT(CASE WHEN u.plan = 'pro' THEN 1 END)::INT * 19.0 AS pro_revenue,
        COUNT(CASE WHEN u.plan = 'agency' THEN 1 END)::INT * 49.0 AS agency_revenue
        FROM users u
        WHERE u.suspended = false AND u.plan IN ('pro', 'agency')`),
    ]);
    const plans = (plansRes.rows || []).reduce((acc, r) => ({ ...acc, [r.plan]: r.n }), {});
    const totalVerifiedSec = Number(sessionsRes.rows[0]?.total_sec ?? 0);
    const totalWallSec = Number(sessionsRes.rows[0]?.total_wall_sec ?? 0);
    const totalMinutes = Math.round(totalVerifiedSec / 60);
    const totalHours = (totalVerifiedSec / 3600).toFixed(2);
    
    return res.json({
      totalUsers: usersRes.rows[0]?.total ?? 0,
      totalSessions: sessionsRes.rows[0]?.total ?? 0,
      totalVerifiedSec,
      totalWallSec,
      totalMinutes,
      totalHours: parseFloat(totalHours),
      plans: { free: plans.free ?? 0, pro: plans.pro ?? 0, agency: plans.agency ?? 0 },
      revenue: {
        pro: parseFloat(revenueRes.rows[0]?.pro_revenue ?? 0),
        agency: parseFloat(revenueRes.rows[0]?.agency_revenue ?? 0),
        total: parseFloat((revenueRes.rows[0]?.pro_revenue ?? 0) + (revenueRes.rows[0]?.agency_revenue ?? 0)),
      },
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
    const { plan, status, search } = req.query;
    
    // Build filters
    const filters = [];
    const params = [];
    let paramIdx = 1;
    
    if (plan && ['free', 'pro', 'agency'].includes(plan)) {
      filters.push(`u.plan = $${paramIdx}`);
      params.push(plan);
      paramIdx++;
    }
    
    if (status === 'suspended') {
      filters.push(`u.suspended = true`);
    } else if (status === 'active') {
      filters.push(`u.suspended = false`);
    }
    
    if (search) {
      filters.push(`(LOWER(u.email) LIKE LOWER($${paramIdx}) OR LOWER(u.name) LIKE LOWER($${paramIdx}))`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    
    const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
    
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.plan, u.suspended, u.is_admin, u.created_at,
              (SELECT COUNT(*)::INT FROM sessions s WHERE s.user_id = u.id) AS session_count,
              (SELECT COALESCE(SUM(verified_sec),0)::BIGINT FROM sessions s WHERE s.user_id = u.id) AS total_verified_sec
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::INT AS total FROM users u ${whereClause}`,
      params
    );
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
