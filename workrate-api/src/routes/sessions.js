/**
 * WorkRate — Sessions Routes
 *
 * POST   /api/sessions/sync        — extension uploads a completed session
 * POST   /api/sessions/sync/batch  — extension bulk-uploads queued sessions
 * GET    /api/sessions             — list sessions (with filters + pagination)
 * GET    /api/sessions/:id         — single session detail
 * PATCH  /api/sessions/:id         — update (share, adjust, notes)
 * DELETE /api/sessions/:id         — soft-delete
 * POST   /api/sessions/:id/approve — client approves a shared session
 * POST   /api/sessions/:id/reject  — client rejects a shared session
 * GET    /api/sessions/stats       — aggregate stats for dashboard widgets
 */
import { Router } from 'express';
import { query, getClient } from '../db/pool.js';
import { requireAuth }      from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // every session route requires auth

/* ─── helpers ────────────────────────────────────────────────────────────── */

// Map snake_case DB row → camelCase API response
function rowToSession(r) {
  return {
    id:                      r.id,
    localId:                 r.local_id,
    userId:                  r.user_id,
    clientId:                r.client_id,
    clientName:              r.client_name,
    task:                    r.task,
    tags:                    r.tags,
    notes:                   r.notes,
    sessionStart:            r.session_start,
    sessionEnd:              r.session_end,
    // Time accounting
    wallSec:                 r.wall_sec,
    verifiedSec:             r.verified_sec,
    offTabSec:               r.off_tab_sec,
    idleSec:                 r.idle_sec,
    verifiedPct:             r.verified_pct,
    offTabPct:               r.off_tab_pct,
    idlePct:                 r.idle_pct,
    focusPct:                r.focus_pct,
    // Quality
    wqi:                     r.wqi,
    registeredTabSwitches:   r.registered_tab_switches,
    unregisteredTabSwitches: r.unregistered_tab_switches,
    // Evidence
    registeredTabs:          r.registered_tabs,
    offTabEvents:            r.off_tab_events,
    activityBlocks:          r.activity_blocks,
    adjustments:             r.adjustments,
    // Client visibility
    shared:                  r.shared,
    approved:                r.approved,
    approvedAt:              r.approved_at,
    rejected:                r.rejected,
    rejectionReason:         r.rejection_reason,
    // Timestamps
    syncedAt:                r.synced_at,
    createdAt:               r.created_at,
    updatedAt:               r.updated_at,
    // Derived (added by stats queries)
    verifiedFormatted:       formatDuration(r.verified_sec),
    wallFormatted:           formatDuration(r.wall_sec),
    date:                    formatDate(r.session_start),
    start:                   formatTime(r.session_start),
    end:                     formatTime(r.session_end),
  };
}

function formatDuration(sec) {
  if (!sec || sec < 0) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d   = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ─── POST /api/sessions/sync ────────────────────────────────────────────── */
// Called by the extension when a session is stopped.
// Idempotent via UNIQUE(user_id, local_id) — safe to retry.
router.post('/sync', async (req, res) => {
  try {
    const uid = req.user.id;
    const s   = req.body;

    if (!s.sessionStart || !s.sessionEnd) {
      return res.status(400).json({ error: 'sessionStart and sessionEnd required' });
    }

    // Resolve clientId from name if provided
    let clientId   = null;
    let clientName = s.client || null;
    if (clientName) {
      const { rows } = await query(
        `SELECT id FROM clients WHERE user_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
        [uid, clientName]
      );
      if (rows.length) {
        clientId = rows[0].id;
      } else {
        // Auto-create client on first mention
        const ins = await query(
          `INSERT INTO clients (user_id, name) VALUES ($1,$2) RETURNING id`,
          [uid, clientName]
        );
        clientId = ins.rows[0].id;
      }
    }

    const wallSec = (s.verifiedSec ?? 0) + (s.offTabSec ?? 0) + (s.idleSec ?? 0);

    const { rows } = await query(
      `INSERT INTO sessions (
         local_id, user_id, client_id, client_name,
         task, tags, notes,
         session_start, session_end,
         wall_sec, verified_sec, off_tab_sec, idle_sec,
         verified_pct, off_tab_pct, idle_pct, focus_pct,
         wqi, registered_tab_switches, unregistered_tab_switches,
         registered_tabs, off_tab_events, activity_blocks, adjustments,
         shared, approved
       ) VALUES (
         $1,$2,$3,$4,
         $5,$6,$7,
         $8,$9,
         $10,$11,$12,$13,
         $14,$15,$16,$17,
         $18,$19,$20,
         $21,$22,$23,$24,
         $25,$26
       )
       ON CONFLICT (user_id, local_id) DO UPDATE SET
         synced_at = NOW()   -- idempotent: already exists, just acknowledge
       RETURNING *`,
      [
        s.id ?? null, uid, clientId, clientName,
        s.task || '', s.tags || [], s.notes || null,
        s.sessionStart, s.sessionEnd,
        wallSec, s.verifiedSec ?? 0, s.offTabSec ?? 0, s.idleSec ?? 0,
        s.verifiedPct ?? 0, s.offTabPct ?? 0, s.idlePct ?? 0, s.focusPct ?? 0,
        s.wqi ?? 0, s.registeredTabSwitches ?? 0, s.unregisteredTabSwitches ?? 0,
        JSON.stringify(s.registeredTabs  ?? []),
        JSON.stringify(s.offTabEvents    ?? []),
        JSON.stringify(s.activityBlocks  ?? []),
        JSON.stringify(s.adjustments     ?? []),
        s.shared ?? false, s.approved ?? false,
      ]
    );

    return res.status(201).json({ session: rowToSession(rows[0]) });
  } catch (err) {
    console.error('[sessions/sync]', err.message);
    return res.status(500).json({ error: 'Sync failed', detail: err.message });
  }
});

/* ─── POST /api/sessions/sync/batch ──────────────────────────────────────── */
// Upload multiple sessions at once (offline queue drain).
// Returns { synced: N, skipped: N, errors: [] }
router.post('/sync/batch', async (req, res) => {
  const { sessions } = req.body;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.status(400).json({ error: 'sessions array required' });
  }
  if (sessions.length > 100) {
    return res.status(400).json({ error: 'Max 100 sessions per batch' });
  }

  let synced = 0, skipped = 0;
  const errors = [];

  for (const s of sessions) {
    try {
      // Reuse single-sync logic via fake req/res
      const uid = req.user.id;
      let clientId = null;
      if (s.client) {
        const { rows } = await query(
          `SELECT id FROM clients WHERE user_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
          [uid, s.client]
        );
        if (rows.length) {
          clientId = rows[0].id;
        } else {
          const ins = await query(`INSERT INTO clients (user_id,name) VALUES ($1,$2) RETURNING id`, [uid, s.client]);
          clientId = ins.rows[0].id;
        }
      }
      const wallSec = (s.verifiedSec ?? 0) + (s.offTabSec ?? 0) + (s.idleSec ?? 0);
      const result = await query(
        `INSERT INTO sessions (
           local_id, user_id, client_id, client_name,
           task, tags, session_start, session_end,
           wall_sec, verified_sec, off_tab_sec, idle_sec,
           verified_pct, off_tab_pct, idle_pct, focus_pct,
           wqi, registered_tab_switches, unregistered_tab_switches,
           registered_tabs, off_tab_events, activity_blocks, adjustments,
           shared, approved
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         ON CONFLICT (user_id, local_id) DO NOTHING
         RETURNING id`,
        [
          s.id ?? null, uid, clientId, s.client || null,
          s.task || '', s.tags || [], s.sessionStart, s.sessionEnd,
          wallSec, s.verifiedSec??0, s.offTabSec??0, s.idleSec??0,
          s.verifiedPct??0, s.offTabPct??0, s.idlePct??0, s.focusPct??0,
          s.wqi??0, s.registeredTabSwitches??0, s.unregisteredTabSwitches??0,
          JSON.stringify(s.registeredTabs??[]), JSON.stringify(s.offTabEvents??[]),
          JSON.stringify(s.activityBlocks??[]), JSON.stringify(s.adjustments??[]),
          s.shared??false, s.approved??false,
        ]
      );
      result.rows.length ? synced++ : skipped++;
    } catch (err) {
      errors.push({ localId: s.id, error: err.message });
    }
  }

  return res.json({ synced, skipped, errors });
});

/* ─── GET /api/sessions ──────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const uid    = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit  ?? 50),  200);
    const offset = Math.max(parseInt(req.query.offset ?? 0),   0);
    const client = req.query.client;     // filter by client name
    const date   = req.query.date;       // "today" | "week" | "month"
    const search = req.query.q;          // task text search

    const conditions = ['s.user_id = $1'];
    const params     = [uid];
    let   p          = 2;

    if (client) {
      conditions.push(`LOWER(s.client_name) = LOWER($${p++})`);
      params.push(client);
    }
    if (date === 'today') {
      conditions.push(`s.session_start >= CURRENT_DATE`);
    } else if (date === 'week') {
      conditions.push(`s.session_start >= NOW() - INTERVAL '7 days'`);
    } else if (date === 'month') {
      conditions.push(`s.session_start >= NOW() - INTERVAL '30 days'`);
    }
    if (search) {
      conditions.push(`s.task ILIKE $${p++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    const { rows } = await query(
      `SELECT s.*
       FROM sessions s
       WHERE ${where}
       ORDER BY s.session_start DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM sessions s WHERE ${where}`,
      params
    );

    return res.json({
      sessions: rows.map(rowToSession),
      total:    parseInt(countRows[0].count),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[sessions/list]', err.message);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/* ─── GET /api/sessions/stats ───────────────────────────────────────────── */
// Aggregates for the dashboard overview widgets.
router.get('/stats', async (req, res) => {
  try {
    const uid = req.user.id;

    const { rows } = await query(
      `SELECT
         COUNT(*)                               AS total_sessions,
         COALESCE(SUM(verified_sec),0)          AS total_verified_sec,
         COALESCE(AVG(wqi)::INT,0)              AS avg_wqi,
         COALESCE(SUM(CASE WHEN session_start >= CURRENT_DATE THEN verified_sec END),0) AS today_verified_sec,
         COALESCE(SUM(CASE WHEN session_start >= NOW()-INTERVAL '7 days' THEN verified_sec END),0) AS week_verified_sec,
         COUNT(DISTINCT client_name)            AS client_count,
         COUNT(CASE WHEN approved THEN 1 END)   AS approved_count,
         COUNT(CASE WHEN shared   THEN 1 END)   AS shared_count,
         -- Streak: consecutive days with at least one session (approximate)
         COUNT(DISTINCT DATE(session_start))    AS active_days
       FROM sessions
       WHERE user_id=$1`,
      [uid]
    );

    const s = rows[0];

    // WQI trend — last 8 weeks
    const { rows: trend } = await query(
      `SELECT
         TO_CHAR(DATE_TRUNC('week', session_start), 'Mon W') AS week,
         ROUND(AVG(wqi))::INT                                AS wqi
       FROM sessions
       WHERE user_id=$1 AND session_start >= NOW() - INTERVAL '8 weeks'
       GROUP BY DATE_TRUNC('week', session_start)
       ORDER BY DATE_TRUNC('week', session_start)`,
      [uid]
    );

    return res.json({
      totalSessions:    parseInt(s.total_sessions),
      totalVerifiedSec: parseInt(s.total_verified_sec),
      avgWqi:           parseInt(s.avg_wqi),
      todayVerifiedSec: parseInt(s.today_verified_sec),
      weekVerifiedSec:  parseInt(s.week_verified_sec),
      clientCount:      parseInt(s.client_count),
      approvedCount:    parseInt(s.approved_count),
      sharedCount:      parseInt(s.shared_count),
      activeDays:       parseInt(s.active_days),
      wqiTrend:         trend,
    });
  } catch (err) {
    console.error('[sessions/stats]', err.message);
    return res.status(500).json({ error: 'Stats query failed' });
  }
});

/* ─── GET /api/sessions/:id ─────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM sessions WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    return res.json({ session: rowToSession(rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/* ─── PATCH /api/sessions/:id ───────────────────────────────────────────── */
// Handles: share toggle, time adjustment, notes, tags
router.patch('/:id', async (req, res) => {
  try {
    const { shared, notes, tags, adjustedVerifiedSec, adjustReason } = req.body;

    // Build adjustment log entry if time is being changed
    let adjustmentsUpdate = null;
    if (adjustedVerifiedSec !== undefined) {
      const { rows: cur } = await query(
        `SELECT verified_sec, adjustments FROM sessions WHERE id=$1 AND user_id=$2`,
        [req.params.id, req.user.id]
      );
      if (!cur.length) return res.status(404).json({ error: 'Session not found' });

      const prev = cur[0];
      const log  = JSON.parse(typeof prev.adjustments === 'string' ? prev.adjustments : JSON.stringify(prev.adjustments));
      log.push({
        originalSec:  prev.verified_sec,
        adjustedSec:  adjustedVerifiedSec,
        reason:       adjustReason || '',
        timestamp:    new Date().toISOString(),
      });
      adjustmentsUpdate = JSON.stringify(log);
    }

    const { rows } = await query(
      `UPDATE sessions SET
         shared       = COALESCE($1, shared),
         notes        = COALESCE($2, notes),
         tags         = COALESCE($3, tags),
         verified_sec = COALESCE($4, verified_sec),
         adjustments  = COALESCE($5::jsonb, adjustments)
       WHERE id=$6 AND user_id=$7
       RETURNING *`,
      [
        shared ?? null,
        notes  ?? null,
        tags   ? `{${tags.map(t => `"${t}"`).join(',')}}` : null,
        adjustedVerifiedSec ?? null,
        adjustmentsUpdate,
        req.params.id,
        req.user.id,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    return res.json({ session: rowToSession(rows[0]) });
  } catch (err) {
    console.error('[sessions/patch]', err.message);
    return res.status(500).json({ error: 'Update failed' });
  }
});

/* ─── POST /api/sessions/:id/approve ───────────────────────────────────── */
// Client-facing. The session must be shared to approve.
// In Phase 2, clients will have their own accounts; for now the freelancer
// can simulate approval from the dashboard.
router.post('/:id/approve', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE sessions SET
         approved    = TRUE,
         approved_at = NOW(),
         approved_by = $1,
         rejected    = FALSE
       WHERE id=$2 AND user_id=$1 AND shared=TRUE
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found or not shared' });
    return res.json({ session: rowToSession(rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: 'Approval failed' });
  }
});

/* ─── POST /api/sessions/:id/reject ────────────────────────────────────── */
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows } = await query(
      `UPDATE sessions SET
         rejected         = TRUE,
         rejection_reason = $1,
         approved         = FALSE
       WHERE id=$2 AND user_id=$3
       RETURNING *`,
      [reason || '', req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    return res.json({ session: rowToSession(rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: 'Rejection failed' });
  }
});

/* ─── DELETE /api/sessions/:id ──────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM sessions WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Session not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
