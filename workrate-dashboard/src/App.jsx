/**
 * WorkRate Dashboard — App Shell
 * ════════════════════════════════
 * Handles:
 *   - Auth gate (show Login until authenticated)
 *   - Loading real sessions + stats from the API
 *   - Passing API-backed actions (addSession, approveSession, etc.)
 *     down to the WorkRate dashboard component
 *
 * WorkRate (the dashboard UI) still owns all rendering — we just
 * swap its mock data and local state mutations for real API calls.
 */
import { useState, useEffect, useCallback } from 'react';
import WorkRate   from './WorkRate.jsx';
import Login      from './components/Login.jsx';
import {
  getStoredUser,
  clearTokens,
  getSessions,
  getSessionStats,
  createSession,
  updateSession,
  approveSession,
  rejectSession,
  getClients,
  logout,
} from './api/client.js';

export default function App() {
  const [user,     setUser]     = useState(() => getStoredUser());
  const [sessions, setSessions] = useState(null);   // null = loading
  const [stats,    setStats]    = useState(null);
  const [clients,  setClients]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState(null);

  /* ── Load data when user is authenticated ── */
  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setApiError(null);
    try {
      const [sessRes, statsRes, clientRes] = await Promise.all([
        getSessions({ limit: 100 }),
        getSessionStats(),
        getClients(),
      ]);
      // Normalize API sessions to dashboard shape (client, duration, etc.)
      const raw = sessRes?.sessions ?? [];
      const normalized = raw.map((s) => normalizeSession(s));
      setSessions(normalized);
      setStats(statsRes ?? {});
      setClients(clientRes?.clients ?? []);
    } catch (err) {
      console.error('[App] load failed:', err.message);
      setApiError(err.message);
      // If 401 after refresh failed, user was logged out by client.js
      if (!getStoredUser()) setUser(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Auth callbacks ── */
  function handleAuth(u) { setUser(u); }
  async function handleLogout() {
    await logout();
    setUser(null);
    setSessions(null);
    setStats(null);
  }

  /* ── Session CRUD — passed to WorkRate component ── */
  function normalizeSession(sess) {
    if (!sess) return sess;
    return {
      ...sess,
      client:   sess.clientName ?? sess.client ?? '—',
      duration: sess.verifiedSec ?? sess.duration ?? 0,
      idle:     sess.idlePct ?? sess.idle ?? 0,
      switches: sess.unregisteredTabSwitches ?? sess.registeredTabSwitches ?? sess.switches ?? 0,
    };
  }

  async function handleAddSession(s) {
    // API expects sessionStart, sessionEnd (ISO). Build from start/end (HH:MM) and today.
    const today = new Date().toISOString().slice(0, 10);
    const [sh, sm] = (s.start || "00:00").split(":").map(Number);
    const durationSec = s.duration ?? s.verifiedSec ?? 3600;
    const sessionStart = new Date(new Date(today).setHours(sh, sm || 0, 0, 0));
    const sessionEnd = new Date(sessionStart.getTime() + durationSec * 1000);
    const payload = {
      ...s,
      sessionStart: sessionStart.toISOString(),
      sessionEnd: sessionEnd.toISOString(),
      verifiedSec: durationSec,
      client: s.client || null,
    };
    try {
      const res = await createSession(payload);
      const saved = normalizeSession(res?.session ?? s);
      setSessions(prev => [saved, ...(prev ?? [])]);
      return saved;
    } catch (err) {
      console.error('[addSession]', err.message);
      setSessions(prev => [normalizeSession(s), ...(prev ?? [])]);
    }
  }

  async function handleApproveSession(id) {
    try {
      await approveSession(id);
      setSessions(prev => prev?.map(s => s.id === id ? { ...s, approved: true } : s));
    } catch (err) {
      console.error('[approveSession]', err.message);
    }
  }

  async function handleAdjustSession(updated) {
    try {
      const res = await updateSession(updated.id, {
        adjustedVerifiedSec: updated.duration ?? updated.verifiedSec,
        adjustReason: updated.adjustReason,
        notes: updated.notes,
        tags:  updated.tags,
      });
      const saved = normalizeSession(res?.session ?? updated);
      setSessions(prev => prev?.map(s => s.id === saved.id ? saved : s));
    } catch (err) {
      console.error('[adjustSession]', err.message);
      setSessions(prev => prev?.map(s => s.id === updated.id ? normalizeSession(updated) : s));
    }
  }

  /* ── Not logged in ── */
  if (!user) return <Login onAuth={handleAuth} />;

  /* ── Loading skeleton ── */
  if (loading && sessions === null) {
    return (
      <div style={{minHeight:'100vh', background:'#F7F6F3', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:36, height:36, border:'3px solid #E3E0D9', borderTopColor:'#1B7A50', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px'}}/>
          <div style={{fontSize:14, color:'#6A6760'}}>Loading your dashboard…</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ── API error banner ── */
  if (apiError && sessions === null) {
    return (
      <div style={{minHeight:'100vh', background:'#F7F6F3', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
        <div style={{background:'#fff', border:'1px solid #E3E0D9', borderRadius:14, padding:'32px 28px', maxWidth:440, textAlign:'center'}}>
          <div style={{fontSize:28, marginBottom:12}}>⚠️</div>
          <div style={{fontSize:16, fontWeight:600, marginBottom:8}}>Couldn't connect to the server</div>
          <div style={{fontSize:13, color:'#6A6760', marginBottom:20}}>{apiError}</div>
          <button onClick={loadAll}
            style={{background:'#1B7A50', color:'#fff', border:'none', borderRadius:9, padding:'10px 22px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit'}}>
            Retry
          </button>
          <button onClick={handleLogout}
            style={{marginLeft:10, background:'transparent', color:'#6A6760', border:'1px solid #E3E0D9', borderRadius:9, padding:'10px 22px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit'}}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  /* ── Main dashboard ── */
  return (
    <WorkRate
      /* Real data */
      initialSessions={sessions ?? []}
      serverStats={stats}
      serverClients={clients}
      currentUser={user}
      /* Actions */
      onAddSession={handleAddSession}
      onApproveSession={handleApproveSession}
      onAdjustSession={handleAdjustSession}
      onLogout={handleLogout}
      onRefresh={loadAll}
    />
  );
}
