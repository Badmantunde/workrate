/**
 * WorkRate Extension — API Client
 * ═══════════════════════════════
 * Handles all communication with the WorkRate backend.
 *
 * Key responsibilities:
 *   1. Store + refresh access/refresh tokens transparently
 *   2. Sync completed sessions to the server immediately on stop
 *   3. Queue sessions when offline, drain the queue when back online
 *   4. Expose auth helpers (login, logout, me) for the popup's settings flow
 *
 * Usage (from worker.js):
 *   import { syncSession, getAuthStatus } from './api.js';
 *   await syncSession(sessionObject);
 */

// ── API URL ─────────────────────────────────────────────────────────────────
// For local development swap to: http://localhost:3001/api
// For production this points to your Railway deployment.
const API_BASE = 'https://workrate-production.up.railway.app/api';

/* ═══════════════════════════════════════════════════════════════════════════
   TOKEN STORAGE
   Tokens live in chrome.storage.local (encrypted by Chrome, not accessible
   to web pages). Never in cookies or localStorage.
═══════════════════════════════════════════════════════════════════════════ */
const TOKEN_KEY = 'wr_tokens'; // { accessToken, refreshToken, userId, email }

async function getTokens() {
  const d = await chrome.storage.local.get(TOKEN_KEY);
  return d[TOKEN_KEY] ?? null;
}

async function saveTokens(tokens) {
  await chrome.storage.local.set({ [TOKEN_KEY]: tokens });
}

async function clearTokens() {
  await chrome.storage.local.remove(TOKEN_KEY);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HTTP CLIENT
   All requests go through here. Handles 401 → token refresh → retry once.
═══════════════════════════════════════════════════════════════════════════ */
async function request(path, options = {}, retry = true) {
  const tokens = await getTokens();

  const headers = {
    'Content-Type': 'application/json',
    ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    ...(options.headers ?? {}),
  };

  const url = `${API_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    // Network error — caller should queue for later
    throw new ApiError('NETWORK', 'No network connection');
  }

  if (res.status === 401 && retry && tokens?.refreshToken) {
    // Access token expired — try to refresh once
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (refreshed) {
      return request(path, options, false); // retry with new token
    }
    // Refresh also failed — user needs to log in again
    await clearTokens();
    throw new ApiError('AUTH', 'Session expired. Please log in again.');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError('API', body.error ?? `HTTP ${res.status}`);
  return body;
}

async function refreshAccessToken(refreshToken) {
  try {
    const body = await fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    }).then(r => r.json());

    if (body.accessToken) {
      const tokens = await getTokens();
      await saveTokens({ ...tokens, accessToken: body.accessToken, refreshToken: body.refreshToken });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   OFFLINE QUEUE
   Sessions that couldn't be synced are stored here and retried on
   the next successful network request.
═══════════════════════════════════════════════════════════════════════════ */
const QUEUE_KEY = 'wr_sync_queue';

async function getQueue() {
  const d = await chrome.storage.local.get(QUEUE_KEY);
  return d[QUEUE_KEY] ?? [];
}

async function addToQueue(session) {
  const q = await getQueue();
  // Avoid duplicates by localId
  if (!q.some(s => s.id === session.id)) q.push(session);
  await chrome.storage.local.set({ [QUEUE_KEY]: q });
  console.log(`[API] Queued session ${session.id} (queue size: ${q.length})`);
}

async function clearQueue() {
  await chrome.storage.local.remove(QUEUE_KEY);
}

/**
 * drainQueue — called when we know we're online. Sends queued sessions
 * to the server in a single batch request.
 */
export async function drainQueue() {
  const q = await getQueue();
  if (q.length === 0) return;

  const tokens = await getTokens();
  if (!tokens?.accessToken) return; // not logged in, skip

  try {
    const result = await request('/sessions/sync/batch', {
      method: 'POST',
      body:   JSON.stringify({ sessions: q }),
    });
    console.log(`[API] Queue drained: ${result.synced} synced, ${result.skipped} skipped`);
    if (result.errors?.length) console.warn('[API] Batch errors:', result.errors);
    await clearQueue();
  } catch (err) {
    console.warn('[API] Queue drain failed, will retry later:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════════════════════ */

/**
 * syncSession — called from worker.js after stopSession().
 * Tries to upload immediately; queues on failure.
 * Returns { ok: true } on success, { ok: false, queued: true } if offline.
 */
export async function syncSession(session) {
  const tokens = await getTokens();
  if (!tokens?.accessToken) {
    // Not logged in — queue for when they do log in
    await addToQueue(session);
    return { ok: false, queued: true, reason: 'not_authenticated' };
  }

  // Try to drain any existing queue first (batch is more efficient)
  await drainQueue();

  try {
    const result = await request('/sessions/sync', {
      method: 'POST',
      body:   JSON.stringify(session),
    });
    console.log('[API] Session synced:', result.session?.id);
    return { ok: true, session: result.session };
  } catch (err) {
    if (err.code === 'NETWORK') {
      await addToQueue(session);
      return { ok: false, queued: true, reason: 'offline' };
    }
    console.error('[API] Sync error:', err.message);
    return { ok: false, reason: err.message };
  }
}

/**
 * login — called from the popup's Settings view.
 * Returns { user, accessToken, refreshToken } on success.
 */
export async function login(email, password) {
  const body = await request('/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ email, password, device: 'Chrome Extension' }),
  }, false);

  await saveTokens({
    accessToken:  body.accessToken,
    refreshToken: body.refreshToken,
    userId:       body.user.id,
    email:        body.user.email,
  });

  // Drain any queued sessions immediately after login
  await drainQueue();

  return body;
}

/**
 * logout — revoke tokens on the server and clear local storage.
 */
export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' }, false);
  } catch (_) {
    // Best-effort server revoke
  }
  await clearTokens();
}

/**
 * getAuthStatus — returns { loggedIn, user } for the popup to display.
 */
export async function getAuthStatus() {
  const tokens = await getTokens();
  if (!tokens?.accessToken) return { loggedIn: false };

  try {
    const { user } = await request('/auth/me');
    return { loggedIn: true, user };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * getSessions — fetch synced sessions from server for the popup list.
 * Falls back to local chrome.storage sessions if not authenticated.
 */
export async function getSessions(params = {}) {
  const tokens = await getTokens();
  if (!tokens?.accessToken) return null; // caller falls back to local

  try {
    const qs  = new URLSearchParams(params).toString();
    const res = await request(`/sessions?${qs}`);
    return res;
  } catch {
    return null;
  }
}

/**
 * getQueueStatus — how many sessions are waiting to sync.
 */
export async function getQueueStatus() {
  const q = await getQueue();
  return { count: q.length, sessions: q };
}