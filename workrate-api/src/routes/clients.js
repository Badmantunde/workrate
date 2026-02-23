/**
 * WorkRate — Clients Routes
 *
 * GET    /api/clients         — list all clients for this user
 * POST   /api/clients         — create client
 * GET    /api/clients/:id     — client detail + aggregated session stats
 * PATCH  /api/clients/:id     — update
 * DELETE /api/clients/:id     — delete (sessions become client_id=null)
 */
import { Router } from 'express';
import { query }  from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/* ─── GET /api/clients ───────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         c.*,
         COUNT(s.id)::INT               AS session_count,
         COALESCE(SUM(s.verified_sec),0)::INT AS total_verified_sec,
         COALESCE(AVG(s.wqi),0)::INT    AS avg_wqi
       FROM clients c
       LEFT JOIN sessions s ON s.client_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.name`,
      [req.user.id]
    );
    return res.json({ clients: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/* ─── POST /api/clients ──────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { name, email, rate } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const { rows } = await query(
      `INSERT INTO clients (user_id, name, email, rate)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, name, email || null, rate || null]
    );
    return res.status(201).json({ client: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create client' });
  }
});

/* ─── GET /api/clients/:id ───────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const { rows: cRows } = await query(
      `SELECT * FROM clients WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!cRows.length) return res.status(404).json({ error: 'Client not found' });

    const { rows: sRows } = await query(
      `SELECT id, task, tags, session_start, session_end,
              verified_sec, wqi, shared, approved
       FROM sessions
       WHERE client_id=$1 AND user_id=$2
       ORDER BY session_start DESC
       LIMIT 50`,
      [req.params.id, req.user.id]
    );

    return res.json({ client: cRows[0], sessions: sRows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch client' });
  }
});

/* ─── PATCH /api/clients/:id ─────────────────────────────────────────────── */
router.patch('/:id', async (req, res) => {
  try {
    const { name, email, rate } = req.body;
    const { rows } = await query(
      `UPDATE clients SET
         name  = COALESCE($1, name),
         email = COALESCE($2, email),
         rate  = COALESCE($3, rate)
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [name, email, rate, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    return res.json({ client: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Update failed' });
  }
});

/* ─── DELETE /api/clients/:id ────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM clients WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Client not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
