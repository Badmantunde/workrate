/**
 * WorkRate Dashboard — API Client
 * ════════════════════════════════
 * All communication with the backend goes through here.
 * Tokens live in localStorage (dashboard context — not extension).
 * Handles 401 → refresh → retry transparently.
 */

const API = import.meta.env.VITE_API_URL ?? '';
// If VITE_API_URL is empty, Vite's proxy forwards /api → localhost:3001 in dev.
// In production (Netlify), set VITE_API_URL to your Railway URL.
// e.g. https://workrate-production.up.railway.app

/* ── Token storage ─────────────────────────────────────────────────────── */
const KEY = {
  access:  'wr_access_token',
  refresh: 'wr_refresh_token',
  user:    'wr_user',
};

export function getStoredUser()   { try { return JSON.parse(localStorage.getItem(KEY.user)); } catch { return null; } }
export function setStoredUser(u)  { try { localStorage.setItem(KEY.user, JSON.stringify(u)); } catch (_) {} }
export function getAccessToken()  { return localStorage.getItem(KEY.access); }
function getRefreshToken()        { return localStorage.getItem(KEY.refresh); }

function saveTokens({ accessToken, refreshToken, user }) {
  if (accessToken)  localStorage.setItem(KEY.access,  accessToken);
  if (refreshToken) localStorage.setItem(KEY.refresh, refreshToken);
  if (user)         localStorage.setItem(KEY.user,    JSON.stringify(user));
}

export function clearTokens() {
  localStorage.removeItem(KEY.access);
  localStorage.removeItem(KEY.refresh);
  localStorage.removeItem(KEY.user);
}

/* ── Core fetch ────────────────────────────────────────────────────────── */
async function req(path, options = {}, retry = true) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  let res;
  try {
    res = await fetch(`${API}/api${path}`, { ...options, headers });
  } catch (err) {
    throw new Error('Network error — check your connection');
  }

  // Token expired — try to refresh once then retry
  if (res.status === 401 && retry) {
    const rt = getRefreshToken();
    if (rt) {
      try {
        const r = await fetch(`${API}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (r.ok) {
          const data = await r.json();
          saveTokens(data);
          return req(path, options, false);
        }
      } catch (_) {}
    }
    // Refresh failed — clear tokens, App.jsx will show the login screen
    clearTokens();
    window.location.href = '/';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? 'Request failed');
  }

  return res.json();
}

/* ── Auth ──────────────────────────────────────────────────────────────── */
export async function login(email, password) {
  const data = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, device: 'Web' }),
  }, false);
  saveTokens(data);
  return data;
}

export async function register(email, password, name) {
  const data = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  }, false);
  saveTokens(data);
  return data;
}

export async function logout() {
  try { await req('/auth/logout', { method: 'POST' }, false); } catch (_) {}
  clearTokens();
}

export async function getMe() {
  return req('/auth/me');
}

export async function updateMe(fields) {
  return req('/auth/me', { method: 'PATCH', body: JSON.stringify(fields) });
}

/* ── Sessions ──────────────────────────────────────────────────────────── */
export async function getSessions(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return req(`/sessions?${qs}`);
}

export async function getSessionStats() {
  return req('/sessions/stats');
}

export async function getSession(id) {
  return req(`/sessions/${id}`);
}

export async function updateSession(id, fields) {
  return req(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
}

export async function approveSession(id) {
  return req(`/sessions/${id}/approve`, { method: 'POST' });
}

export async function rejectSession(id, reason) {
  return req(`/sessions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function deleteSession(id) {
  return req(`/sessions/${id}`, { method: 'DELETE' });
}

export async function createSession(fields) {
  return req('/sessions/sync', { method: 'POST', body: JSON.stringify(fields) });
}

/* ── Clients ───────────────────────────────────────────────────────────── */
export async function getClients(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return req(`/clients${qs ? `?${qs}` : ''}`);
}

export async function lookupClientsByEmail(email) {
  if (!email || !String(email).includes('@')) return { clients: [] };
  return getClients({ email: String(email).trim() });
}

export async function createClient(fields) {
  return req('/clients', { method: 'POST', body: JSON.stringify(fields) });
}

export async function updateClient(id, fields) {
  return req(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
}

export async function deleteClient(id) {
  return req(`/clients/${id}`, { method: 'DELETE' });
}