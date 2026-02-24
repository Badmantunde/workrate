/**
 * WorkRate — Background Service Worker v1.2
 * ══════════════════════════════════════════
 *
 * IDLE PAUSE / RESUME MODEL (simple and exact)
 * ─────────────────────────────────────────────
 * One flag controls whether verified time is counting: state.clockRunning
 *
 * clockRunning = true  ONLY when ALL of:
 *   • session is running
 *   • user is on a registered project tab
 *   • system is NOT idle (chrome.idle)
 *   • user has had mouse/keyboard activity in the last TAB_ACTIVITY_IDLE_SEC
 *
 * Any of those become false → clockRunning = false → verified clock pauses immediately
 * All become true again     → clockRunning = true  → verified clock resumes immediately
 *
 * The heartbeat (every 30s) adds elapsed seconds to the right bucket based on
 * whatever clockRunning was during that window. The popup mirrors clockRunning
 * exactly — it never guesses or has its own logic.
 *
 * Badge colours:
 *   ● Green  = clockRunning true  (verified time counting)
 *   ○ Grey   = off registered tab (not counting, not idle)
 *   ⏸ Amber  = idle detected      (not counting, clock paused)
 *   (empty)  = session stopped
 */

import {
  STORAGE_KEYS,
  IDLE_THRESHOLD_SEC,
  TAB_ACTIVITY_IDLE_SEC,
  HEARTBEAT_INTERVAL_MIN,
  DISTRACTING_DOMAINS,
  WQI_WEIGHTS,
} from './constants.js';

import {
  syncSession,
  drainQueue,
  login,
  logout,
  getAuthStatus,
  getSessions,
  getQueueStatus,
} from './api.js';

/* ═══════════════════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════════════════ */
const DEFAULT_STATE = {
  isRunning:        false,
  sessionStart:     null,

  // The three time buckets
  verifiedSec:      0,   // on registered tab + not idle  ← the billable number
  offTabSec:        0,   // on unregistered tab (timer running, not idle)
  idleSec:          0,   // idle (system or activity), regardless of tab

  // clockRunning is the single source of truth for whether verified time ticks
  // false = clock is paused (either idle OR off registered tab)
  clockRunning:     false,

  // Reason the clock is paused — for UI messaging
  // "idle_system" | "idle_activity" | "off_tab" | null
  pauseReason:      null,

  // Timestamps for precise accounting
  // When the current "window" started (last time clockRunning changed)
  windowStartMs:    null,

  task:             "",
  client:           "",
  tags:             [],

  registeredTabs:   [],
  activeTabId:      null,
  activeTabDomain:  null,
  onRegisteredTab:  false,

  // Idle flags (both must be false for clock to run)
  systemIdle:       false,
  activityIdle:     false,
  lastActivityMs:   null,

  // Audit log
  offTabEvents:          [],
  _offTabStart:          null,
  registeredTabSwitches:   0,
  unregisteredTabSwitches: 0,

  // Heatmap
  activityBlocks:   [],

  // Internal
  lastHeartbeatMs:  null,
  deepWorkEnabled:  false,
  customBlockList:  null,   // set from dashboard session config; null = use DISTRACTING_DOMAINS
};

let state = { ...DEFAULT_STATE };

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
chrome.runtime.onInstalled.addListener(async () => {
  const saved = await chrome.storage.local.get(STORAGE_KEYS.STATE);
  if (saved[STORAGE_KEYS.STATE]) state = { ...DEFAULT_STATE, ...saved[STORAGE_KEYS.STATE] };
  await setupAlarms();
  log("Installed / state restored.");
});

chrome.runtime.onStartup.addListener(async () => {
  const saved = await chrome.storage.local.get(STORAGE_KEYS.STATE);
  if (saved[STORAGE_KEYS.STATE]) {
    state = { ...DEFAULT_STATE, ...saved[STORAGE_KEYS.STATE] };
    if (state.isRunning && state.lastHeartbeatMs) {
      // Browser was closed while running — treat gap as idle (conservative)
      const gapSec = Math.floor((Date.now() - state.lastHeartbeatMs) / 1000);
      state.idleSec += gapSec;
      state.clockRunning  = false;
      state.pauseReason   = "idle_system";
      state.windowStartMs = Date.now();
    }
  }
  await setupAlarms();
  log("Startup / state restored.");
});

/* ═══════════════════════════════════════════════════════════════════════════
   HEARTBEAT — every 30s
   Only job: flush elapsed time into the right bucket, check activity idle,
   record heatmap, persist, broadcast.
═══════════════════════════════════════════════════════════════════════════ */
async function setupAlarms() {
  await chrome.alarms.clearAll();
  chrome.alarms.create("heartbeat", { periodInMinutes: HEARTBEAT_INTERVAL_MIN });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "heartbeat") onHeartbeat();
});

function onHeartbeat() {
  if (!state.isRunning) return;
  const now = Date.now();

  // ── Check activity idle (no movement on registered tab) ──
  if (state.clockRunning && !state.systemIdle && state.onRegisteredTab && state.lastActivityMs) {
    const sinceActivity = (now - state.lastActivityMs) / 1000;
    if (sinceActivity >= TAB_ACTIVITY_IDLE_SEC) {
      // Idle started exactly at lastActivityMs + threshold
      const idleAt = state.lastActivityMs + TAB_ACTIVITY_IDLE_SEC * 1000;
      state.activityIdle = true;
      flushWindow(idleAt);           // close the running window at the exact idle point
      state.clockRunning = false;
      state.pauseReason  = "idle_activity";
      state.windowStartMs = idleAt;
      log(`Activity idle detected — clock paused at ${new Date(idleAt).toLocaleTimeString()}`);
      updateBadge();
      broadcastState();
    }
  }

  // ── Flush current window up to now ──
  flushWindow(now);

  // ── Heatmap ──
  if (state.clockRunning) recordHeatmapBlock(now, false);
  else if (state.onRegisteredTab && state.activityIdle) recordHeatmapBlock(now, "idle");
  else if (!state.onRegisteredTab) recordHeatmapBlock(now, "offtab");

  state.lastHeartbeatMs = now;
  persistState();
  broadcastState();
}

/**
 * flushWindow — commits elapsed time since state.windowStartMs into the right
 * bucket based on current clockRunning state, then resets the window.
 * Called whenever clockRunning changes AND on every heartbeat.
 */
function flushWindow(nowMs) {
  if (!state.isRunning || !state.windowStartMs) {
    state.windowStartMs = nowMs;
    return;
  }
  const elapsedSec = Math.max(0, Math.round((nowMs - state.windowStartMs) / 1000));
  if (elapsedSec === 0) { state.windowStartMs = nowMs; return; }

  if (state.clockRunning) {
    state.verifiedSec += elapsedSec;
  } else if (state.systemIdle || state.activityIdle) {
    state.idleSec += elapsedSec;
  } else {
    state.offTabSec += elapsedSec;
  }

  state.windowStartMs = nowMs;
}

/* ═══════════════════════════════════════════════════════════════════════════
   setClockRunning — the ONE function that changes clockRunning.
   Always calls flushWindow first so no time is misattributed.
═══════════════════════════════════════════════════════════════════════════ */
function setClockRunning(shouldRun, reason = null) {
  const now = Date.now();
  if (shouldRun === state.clockRunning) return; // no change

  flushWindow(now); // commit time in the OLD state before flipping

  state.clockRunning  = shouldRun;
  state.pauseReason   = shouldRun ? null : reason;
  state.windowStartMs = now;

  log(`Clock ${shouldRun ? "▶ RUNNING" : `⏸ PAUSED (${reason})`}`);
  updateBadge();
  persistState();
  broadcastState();
}

/* ═══════════════════════════════════════════════════════════════════════════
   SYSTEM IDLE — chrome.idle API fires immediately on state change
═══════════════════════════════════════════════════════════════════════════ */
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);

chrome.idle.onStateChanged.addListener(idleState => {
  if (!state.isRunning) return;
  log(`chrome.idle: ${idleState}`);

  if (idleState === "idle" || idleState === "locked") {
    state.systemIdle = true;
    state.activityIdle = false; // system idle supersedes activity idle
    setClockRunning(false, "idle_system");

  } else if (idleState === "active") {
    state.systemIdle   = false;
    state.activityIdle = false;
    state.lastActivityMs = Date.now();
    // Resume ONLY if we're on a registered tab
    if (state.onRegisteredTab) {
      setClockRunning(true);
    }
    log("System active — clock resumed.");
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENT SCRIPT ACTIVITY SIGNAL
   Fires every 30s from registered tabs when user is moving mouse / scrolling.
   This is what clears activity idle.
═══════════════════════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ACTIVITY_SIGNAL") {
    const fromRegistered = state.isRunning &&
      state.registeredTabs.some(t => t.tabId === sender.tab?.id);

    if (fromRegistered) {
      const wasActivityIdle = state.activityIdle;
      state.lastActivityMs  = Date.now();
      state.activityIdle    = false;

      // If we were paused specifically due to activity idle, resume now
      if (wasActivityIdle && !state.systemIdle && state.onRegisteredTab) {
        log("Activity detected — resuming clock.");
        setClockRunning(true);
      }
    }

    sendResponse({ ok: true });
    return;
  }

  handleMessage(msg, sender, sendResponse);
  return true;
});

/* ═══════════════════════════════════════════════════════════════════════════
   TAB FOCUS — every tab change evaluated immediately
═══════════════════════════════════════════════════════════════════════════ */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!state.isRunning) return;
  try { await handleTabFocus(await chrome.tabs.get(tabId)); } catch (_) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!state.isRunning || changeInfo.status !== "complete" || !tab.active) return;
  await handleTabFocus(tab);
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (state.registeredTabs.some(t => t.tabId === tabId)) {
    state.registeredTabs = state.registeredTabs.filter(t => t.tabId !== tabId);
    log(`Registered tab ${tabId} closed — removed.`);
    // If that was the active registered tab, pause the clock
    if (state.activeTabId === tabId) {
      state.onRegisteredTab = false;
      setClockRunning(false, "off_tab");
    }
    persistState();
    broadcastState();
  }
});

async function handleTabFocus(tab) {
  if (!tab?.url) return;
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;

  let domain = "unknown";
  try { domain = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) { return; }

  // Deep Work Mode — use custom block list if set, otherwise fall back to defaults
  if (state.deepWorkEnabled) {
    const effectiveList = state.customBlockList || DISTRACTING_DOMAINS;
    if (effectiveList.some(b => domain === b || domain.endsWith("." + b))) {
      const sessionId = state.sessionStart ? btoa(state.sessionStart).slice(0,8) : "s";
      chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL(`popup/blocked.html?from=${encodeURIComponent(domain)}&sessionId=${sessionId}`)
      });
      return;
    }
  }

  const prevTabId       = state.activeTabId;
  const wasOnRegistered = state.onRegisteredTab;
  const isRegistered    = state.registeredTabs.some(t => t.tabId === tab.id);

  // ── Close off-tab audit event if returning to project ──
  if (state._offTabStart && isRegistered) {
    const dur = Math.floor((Date.now() - state._offTabStart) / 1000);
    if (dur > 3) state.offTabEvents.push({ domain: state.activeTabDomain || "unknown", startMs: state._offTabStart, durationSec: dur });
    state._offTabStart = null;
  }

  // ── Open new off-tab event if leaving project ──
  if (!isRegistered && wasOnRegistered) {
    state._offTabStart = Date.now();
    state.unregisteredTabSwitches++;
  }

  // ── Count registered-tab internal switches ──
  if (isRegistered && wasOnRegistered && tab.id !== prevTabId) {
    state.registeredTabSwitches++;
  }

  state.activeTabId     = tab.id;
  state.activeTabDomain = domain;
  state.onRegisteredTab = isRegistered;

  if (isRegistered) {
    // Reset activity idle when arriving on a project tab
    state.lastActivityMs = Date.now();
    state.activityIdle   = false;
    // Run clock only if also not system-idle
    if (!state.systemIdle) setClockRunning(true);
    else                    setClockRunning(false, "idle_system");
  } else {
    // Left all registered tabs — pause clock
    setClockRunning(false, "off_tab");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB REGISTRATION
═══════════════════════════════════════════════════════════════════════════ */
async function registerTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url || tab.url.startsWith("chrome://")) return null;
    let domain = "unknown";
    try { domain = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) { return null; }
    if (state.registeredTabs.some(t => t.tabId === tabId)) return null; // already registered
    const entry = { tabId, domain, title: tab.title || domain, favicon: tab.favIconUrl || null, registeredAt: new Date().toISOString() };
    state.registeredTabs.push(entry);
    persistState();
    broadcastState();
    log(`Registered: ${domain} (tabId ${tabId})`);
    return entry;
  } catch (_) { return null; }
}

function unregisterTab(tabId) {
  state.registeredTabs = state.registeredTabs.filter(t => t.tabId !== tabId);
  if (state.activeTabId === tabId) {
    state.onRegisteredTab = false;
    setClockRunning(false, "off_tab");
  }
  persistState();
  broadcastState();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE API
═══════════════════════════════════════════════════════════════════════════ */
function handleMessage(msg, _sender, sendResponse) {
  switch (msg.type) {

    case "GET_STATE":
      sendResponse({ success: true, state: sanitizeState(state) });
      break;

    case "REGISTER_CURRENT_TAB":
      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        const entry = tab ? await registerTab(tab.id) : null;
        sendResponse({ success: true, entry });
      });
      return true;

    case "REGISTER_ALL_TABS":
      chrome.tabs.query({ currentWindow: true }, async tabs => {
        const results = [];
        for (const t of tabs) {
          if (!t.url?.startsWith("chrome://") && !t.url?.startsWith("chrome-extension://")) {
            const r = await registerTab(t.id);
            if (r) results.push(r);
          }
        }
        sendResponse({ success: true, entries: results });
      });
      return true;

    case "REGISTER_TAB":
      registerTab(msg.payload.tabId).then(entry => sendResponse({ success: true, entry }));
      return true;

    case "UNREGISTER_TAB":
      unregisterTab(msg.payload.tabId);
      sendResponse({ success: true });
      break;

    case "CLEAR_REGISTERED_TABS":
      state.registeredTabs = [];
      state.onRegisteredTab = false;
      setClockRunning(false, "off_tab");
      sendResponse({ success: true });
      break;

    case "START_SESSION":
      startSession(msg.payload);
      sendResponse({ success: true });
      break;

    case "STOP_SESSION":
      stopSession();
      sendResponse({ success: true });
      break;

    case "ADJUST_TIME":
      state.verifiedSec = Math.max(0, msg.payload.newVerifiedSec);
      state._adjustment = { reason: msg.payload.reason, timestamp: new Date().toISOString() };
      persistState();
      broadcastState();
      sendResponse({ success: true });
      break;

    case "SET_DEEP_WORK":
      state.deepWorkEnabled = !!msg.payload.enabled;
      // Accept a custom blockList from the dashboard; fall back to built-in list
      if (Array.isArray(msg.payload.blockList) && msg.payload.blockList.length > 0) {
        state.customBlockList = msg.payload.blockList;
      } else if (!msg.payload.enabled) {
        state.customBlockList = null; // clear on disable
      }
      // Immediately redirect any currently open tab that is on the block list
      if (state.deepWorkEnabled) {
        const effectiveList = state.customBlockList || DISTRACTING_DOMAINS;
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          tabs.forEach(tab => {
            if (!tab.url) return;
            try {
              const domain = new URL(tab.url).hostname.replace(/^www\./, "");
              if (effectiveList.some(b => domain === b || domain.endsWith("." + b))) {
                const sid = state.sessionStart ? btoa(state.sessionStart).slice(0,8) : "s";
                chrome.tabs.update(tab.id, { url: chrome.runtime.getURL(`popup/blocked.html?from=${encodeURIComponent(domain)}&sessionId=${sid}`) });
              }
            } catch (_) {}
          });
        });
      }
      persistState();
      broadcastState();
      sendResponse({ success: true });
      break;

    case "UPDATE_TASK":
      state.task   = msg.payload.task   ?? state.task;
      state.client = msg.payload.client ?? state.client;
      state.tags   = msg.payload.tags   ?? state.tags;
      persistState();
      sendResponse({ success: true });
      break;

    case "GET_SESSIONS":
      // Try server first; fall back to local chrome.storage
      getSessions({ limit: 50 }).then(serverResult => {
        if (serverResult?.sessions) {
          sendResponse({ success: true, sessions: serverResult.sessions, source: 'server' });
        } else {
          chrome.storage.local.get(STORAGE_KEYS.SESSIONS, data => {
            sendResponse({ success: true, sessions: data[STORAGE_KEYS.SESSIONS] || [], source: 'local' });
          });
        }
      }).catch(() => {
        chrome.storage.local.get(STORAGE_KEYS.SESSIONS, data => {
          sendResponse({ success: true, sessions: data[STORAGE_KEYS.SESSIONS] || [], source: 'local' });
        });
      });
      return true;

    case "CLEAR_SESSIONS":
      chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: [] });
      sendResponse({ success: true });
      break;

    case "AUTH_LOGIN":
      login(msg.payload.email, msg.payload.password)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err  => sendResponse({ success: false, error: err.message }));
      return true;

    case "AUTH_LOGOUT":
      logout()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case "AUTH_STATUS":
      getAuthStatus()
        .then(result => sendResponse({ success: true, ...result }))
        .catch(() => sendResponse({ success: true, loggedIn: false }));
      return true;

    case "AUTH_DRAIN_QUEUE":
      drainQueue()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case "AUTH_QUEUE_STATUS":
      getQueueStatus()
        .then(result => sendResponse({ success: true, ...result }))
        .catch(() => sendResponse({ success: true, count: 0 }));
      return true;

    case "GET_OPEN_TABS":
      chrome.tabs.query({ currentWindow: true }, tabs => {
        const clean = tabs
          .filter(t => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("chrome-extension://"))
          .map(t => ({
            tabId:   t.id,
            domain:  (() => { try { return new URL(t.url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })(),
            title:   t.title || "Untitled",
            favicon: t.favIconUrl || null,
            active:  t.active,
          }));
        sendResponse({ success: true, tabs: clean });
      });
      return true;

    case "DASHBOARD_AUTH":
      // Dashboard pushed auth tokens via localStorage → content script → here
      // Save tokens directly into chrome.storage.local so api.js can use them
      (async () => {
        try {
          await chrome.storage.local.set({
            wr_tokens: {
              accessToken:  msg.tokens?.accessToken,
              refreshToken: msg.tokens?.refreshToken,
              userId:       msg.user?.id,
              email:        msg.user?.email,
            }
          });
          // Drain any queued sessions now that we have tokens
          await drainQueue();
          sendResponse({ success: true });
        } catch(e){
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    case "DASHBOARD_SESSION_START":
      // Dashboard timer started → mirror in extension
      (async () => {
        try {
          const payload = msg.payload || {};
          // Set registered tabs from dashboard config
          if(Array.isArray(payload.registeredTabs) && payload.registeredTabs.length > 0){
            state.registeredTabs = payload.registeredTabs;
          }
          // Apply deep work settings from dashboard
          if (payload.deepWork !== undefined) {
            state.deepWorkEnabled = !!payload.deepWork;
            if (Array.isArray(payload.blockList) && payload.blockList.length > 0) {
              state.customBlockList = payload.blockList;
            }
          }
          if(!state.isRunning){
            startSession({
              task:   payload.task   || "Dashboard session",
              client: payload.client || "",
              tags:   [],
            });
          }
          sendResponse({ success: true });
        } catch(e){
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    case "DASHBOARD_SESSION_STOP":
      // Dashboard timer stopped → stop extension session
      (async () => {
        try {
          if(state.isRunning) await stopSession();
          sendResponse({ success: true });
        } catch(e){
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    default:
      sendResponse({ success: false, error: `Unknown: ${msg.type}` });
  }
  return true;
}

chrome.commands.onCommand.addListener(command => {
  if (command !== "toggle-timer") return;
  if (state.isRunning) stopSession();
  else if (state.registeredTabs.length > 0) startSession({ task: state.task || "Quick session", client: state.client });
  else broadcastError("Register project tabs first.");
});

/* ═══════════════════════════════════════════════════════════════════════════
   SESSION LIFECYCLE
═══════════════════════════════════════════════════════════════════════════ */
function startSession({ task = "", client = "", tags = [] }) {
  if (state.isRunning) return;
  if (state.registeredTabs.length === 0) { broadcastError("Register at least one project tab first."); return; }

  const now = Date.now();
  state.isRunning       = true;
  state.sessionStart    = new Date(now).toISOString();
  state.verifiedSec     = 0;
  state.offTabSec       = 0;
  state.idleSec         = 0;
  state.task            = task;
  state.client          = client;
  state.tags            = tags;
  state.activityBlocks  = [];
  state.offTabEvents    = [];
  state.registeredTabSwitches   = 0;
  state.unregisteredTabSwitches = 0;
  state.systemIdle      = false;
  state.activityIdle    = false;
  state.lastActivityMs  = now;
  state.lastHeartbeatMs = now;
  state.windowStartMs   = now;
  state._offTabStart    = null;
  state.clockRunning    = false;  // will be set correctly by handleTabFocus below
  state.pauseReason     = null;

  // Determine clock state from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) handleTabFocus(tab);
  });

  updateBadge();
  persistState();
  broadcastState();
  log(`Session started: "${task}" | ${state.registeredTabs.length} registered tab(s)`);
}

function stopSession() {
  if (!state.isRunning) return;

  const now = Date.now();
  flushWindow(now);  // commit any remaining time

  // Close open off-tab event
  if (state._offTabStart) {
    const dur = Math.floor((now - state._offTabStart) / 1000);
    state.offTabEvents.push({ domain: state.activeTabDomain || "unknown", startMs: state._offTabStart, durationSec: dur });
  }

  const { verifiedSec, offTabSec, idleSec } = state;
  const wallSec     = verifiedSec + offTabSec + idleSec;
  const activeTime  = verifiedSec + offTabSec;
  const focusRatio  = activeTime > 0 ? verifiedSec / activeTime : 0;
  const sw          = state.unregisteredTabSwitches;
  const consistency = sw <= 2 ? 1.0 : Math.max(0.35, 1 - (sw - 2) * 0.09);
  const wqi = Math.min(100, Math.max(0, Math.round(
    (focusRatio * WQI_WEIGHTS.focus + 0.76 * WQI_WEIGHTS.output + consistency * WQI_WEIGHTS.consistency) * 100
  )));

  const session = {
    id:               Date.now(),
    task:             state.task,
    client:           state.client,
    tags:             state.tags,
    date:             "Today",
    sessionStart:     state.sessionStart,
    sessionEnd:       new Date(now).toISOString(),
    wallSec,
    verifiedSec,
    offTabSec,
    idleSec,
    verifiedFormatted: formatDuration(verifiedSec),
    wallFormatted:     formatDuration(wallSec),
    verifiedPct:  wallSec > 0 ? Math.round((verifiedSec / wallSec) * 100) : 0,
    offTabPct:    wallSec > 0 ? Math.round((offTabSec   / wallSec) * 100) : 0,
    idlePct:      wallSec > 0 ? Math.round((idleSec     / wallSec) * 100) : 0,
    focusPct:     Math.round(focusRatio * 100),
    wqi,
    registeredTabSwitches:   state.registeredTabSwitches,
    unregisteredTabSwitches: state.unregisteredTabSwitches,
    registeredTabs: state.registeredTabs.map(t => ({ domain: t.domain, title: t.title })),
    offTabEvents:   [...state.offTabEvents],
    activityBlocks: [...state.activityBlocks],
    adjustments:    [],
    approved:       false,
    shared:         false,
  };

  saveSession(session);

  const preserved = { registeredTabs: state.registeredTabs, deepWorkEnabled: state.deepWorkEnabled, customBlockList: state.customBlockList };
  state = { ...DEFAULT_STATE, ...preserved, lastActivityMs: Date.now() };

  updateBadge();
  persistState();
  broadcastState();

  chrome.notifications.create({
    type: "basic", iconUrl: "icons/icon48.png",
    title: "Session complete — WorkRate",
    message: `${session.task} · ${session.verifiedFormatted} verified · WQI ${wqi}`,
  });

  log(`Stopped. Verified: ${verifiedSec}s | Off-tab: ${offTabSec}s | Idle: ${idleSec}s | WQI: ${wqi}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEATMAP
═══════════════════════════════════════════════════════════════════════════ */
function recordHeatmapBlock(nowMs, type /* false=verified | "offtab" | "idle" */) {
  const d     = new Date(nowMs);
  const hour  = d.getHours();
  const block = Math.floor(d.getMinutes() / 5);
  const MAX   = 300;

  let idx = state.activityBlocks.findIndex(b => b.hour === hour && b.block === block);
  if (idx < 0) {
    state.activityBlocks.push({ hour, block, verifiedSec: 0, offTabSec: 0, idleSec: 0, intensity: 0 });
    idx = state.activityBlocks.length - 1;
  }

  const b = state.activityBlocks[idx];
  if (type === false)      b.verifiedSec = Math.min(MAX, b.verifiedSec + 30);
  else if (type === "offtab") b.offTabSec = Math.min(MAX, (b.offTabSec||0) + 30);
  else if (type === "idle")   b.idleSec   = Math.min(MAX, (b.idleSec||0)   + 30);

  b.intensity = Math.min(100, Math.round((b.verifiedSec / MAX) * 100));
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
async function saveSession(session) {
  // 1. Always save locally first — this is the source of truth if offline
  const data     = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
  const sessions = data[STORAGE_KEYS.SESSIONS] || [];
  sessions.unshift(session);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions.slice(0, 500) });

  // 2. Try to sync to the server (queues automatically if offline/not logged in)
  syncSession(session).then(result => {
    if (result.ok) {
      log(`Session synced to server: ${session.id}`);
    } else if (result.queued) {
      log(`Session queued for sync (${result.reason}): ${session.id}`);
    }
  }).catch(err => {
    log(`Session sync error: ${err.message}`);
  });
}

function sanitizeState(s) {
  return {
    isRunning:               s.isRunning,
    sessionStart:            s.sessionStart,
    verifiedSec:             s.verifiedSec,
    offTabSec:               s.offTabSec,
    idleSec:                 s.idleSec,
    clockRunning:            s.clockRunning,   // ← popup mirrors this directly
    pauseReason:             s.pauseReason,
    task:                    s.task,
    client:                  s.client,
    tags:                    s.tags,
    registeredTabs:          s.registeredTabs,
    activeTabDomain:         s.activeTabDomain,
    onRegisteredTab:         s.onRegisteredTab,
    systemIdle:              s.systemIdle,
    activityIdle:            s.activityIdle,
    registeredTabSwitches:   s.registeredTabSwitches,
    unregisteredTabSwitches: s.unregisteredTabSwitches,
    offTabEvents:            s.offTabEvents,
    activityBlocks:          s.activityBlocks,
    deepWorkEnabled:         s.deepWorkEnabled,
  };
}

function persistState() {
  chrome.storage.local.set({ [STORAGE_KEYS.STATE]: state });
}

function broadcastState() {
  chrome.runtime.sendMessage({ type: "STATE_UPDATE", state: sanitizeState(state) }).catch(() => {});
}

function broadcastError(msg) {
  chrome.runtime.sendMessage({ type: "ERROR", message: msg }).catch(() => {});
}

function updateBadge() {
  if (!state.isRunning) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  if (state.systemIdle || state.activityIdle) {
    chrome.action.setBadgeText({ text: "⏸" });
    chrome.action.setBadgeBackgroundColor({ color: "#B8520E" });
  } else if (state.clockRunning) {
    chrome.action.setBadgeText({ text: "●" });
    chrome.action.setBadgeBackgroundColor({ color: "#1B7A50" });
  } else {
    chrome.action.setBadgeText({ text: "○" });
    chrome.action.setBadgeBackgroundColor({ color: "#A5A29A" });
  }
}

function formatDuration(sec) {
  if (!sec || sec < 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function log(...args) { console.log("[WorkRate]", ...args); }