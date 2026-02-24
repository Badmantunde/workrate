/**
 * WorkRate — Popup Controller v1.2
 * ══════════════════════════════════
 * The worker is the single source of truth.
 * This file only renders state and fires messages — zero tracking logic.
 *
 * Key: state.clockRunning (mirrored from worker) controls whether verified
 * time ticks in the local 1s UI tick. Nothing else decides that.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
// The dashboard URL where sessions are deep-linked.
// In production this is your deployed SaaS URL.
// In development, point this to localhost or your preview URL.
// Replace with your Netlify URL once deployed.
// e.g. "https://workrate.netlify.app/dashboard" or your custom domain.
const DASHBOARD_URL = 'https://my-workrate.netlify.app/dashboard';

/* ═══════════════════════════════════════════════════════════════════════════
   STATE — mirrors worker's sanitizeState output
═══════════════════════════════════════════════════════════════════════════ */
let state = {
  isRunning:               false,
  verifiedSec:             0,
  offTabSec:               0,
  idleSec:                 0,
  clockRunning:            false,  // ← the only flag the tick needs
  pauseReason:             null,   // "idle_system" | "idle_activity" | "off_tab" | null
  task:                    "",
  client:                  "",
  tags:                    [],
  registeredTabs:          [],
  activeTabDomain:         null,
  onRegisteredTab:         false,
  systemIdle:              false,
  activityIdle:            false,
  unregisteredTabSwitches: 0,
  offTabEvents:            [],
  activityBlocks:          [],
  deepWorkEnabled:         false,
};

let selectedTags   = [];
let localTickTimer = null;
let lastWorkerSync = 0;

/* ═══════════════════════════════════════════════════════════════════════════
   DOM
═══════════════════════════════════════════════════════════════════════════ */
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  await syncFromWorker();
  renderAll();
  startLocalTick();
  bindAllEvents();
  showView(state.isRunning ? "tracking" : "setup");
  // Load auth state in background (non-blocking)
  refreshAuthUI();
});

// Push updates from worker arrive here instantly
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "STATE_UPDATE") {
    state = { ...state, ...msg.state };
    renderAll();
  }
  if (msg.type === "ERROR") {
    showSetupError(msg.message);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   WORKER COMMS
═══════════════════════════════════════════════════════════════════════════ */
async function syncFromWorker() {
  const res = await send("GET_STATE");
  if (res?.success) { state = { ...state, ...res.state }; lastWorkerSync = Date.now(); }
}

function send(type, payload = {}) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type, payload }, res => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(res);
      });
    } catch (_) { resolve(null); }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCAL TICK
   Increments the right counter every second based solely on clockRunning.
   No independent logic — just mirrors what the worker is doing.
═══════════════════════════════════════════════════════════════════════════ */
function startLocalTick() {
  clearInterval(localTickTimer);
  localTickTimer = setInterval(async () => {
    if (state.isRunning) {
      if (state.clockRunning) {
        // Verified clock is running — count it
        state.verifiedSec++;
      } else if (state.systemIdle || state.activityIdle) {
        // Paused due to idle — accumulate idle seconds
        state.idleSec++;
      } else {
        // Paused because off registered tab
        state.offTabSec++;
      }
      renderTimers();
      renderBreakdown();
    }
    // Re-sync with worker every 8s to correct drift
    if (Date.now() - lastWorkerSync > 8_000) await syncFromWorker();
  }, 1000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER
═══════════════════════════════════════════════════════════════════════════ */
const VIEWS = ["setup", "tracking", "adjust", "sessions", "settings"];

function showView(name) {
  VIEWS.forEach(v => {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("active", v === name);
  });
  ["setup", "sessions"].forEach(v => {
    const btn = document.querySelector(`[data-view="${v}"]`);
    if (btn) btn.classList.toggle("active", v === name);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER — SETUP VIEW
═══════════════════════════════════════════════════════════════════════════ */
function renderSetup() {
  renderRegisteredList();
  updateStartBtn();
}

function renderRegisteredList() {
  const list = $("registeredList");
  const tabs = state.registeredTabs;
  if (tabs.length === 0) {
    list.classList.add("empty");
    list.innerHTML = `<div class="empty-tabs">No tabs registered yet.<br/>Add the tabs you'll work in below.</div>`;
    return;
  }
  list.classList.remove("empty");
  list.innerHTML = tabs.map(t => `
    <div class="registered-tab-row" data-tabid="${t.tabId}">
      ${t.favicon
        ? `<img class="tab-favicon" src="${escHtml(t.favicon)}" onerror="this.style.display='none'"/>`
        : `<div class="tab-favicon-placeholder">◎</div>`}
      <div class="tab-info">
        <div class="tab-domain">${escHtml(t.domain)}</div>
        <div class="tab-title">${escHtml(t.title)}</div>
      </div>
      <button class="tab-remove" data-tabid="${t.tabId}">×</button>
    </div>
  `).join("");
  list.querySelectorAll(".tab-remove").forEach(btn =>
    btn.addEventListener("click", e => { e.stopPropagation(); removeTab(parseInt(btn.dataset.tabid)); })
  );
}

function updateStartBtn() {
  const btn     = $("startSessionBtn");
  const hasTask = $("taskInput").value.trim().length > 0;
  const hasTabs = state.registeredTabs.length > 0;
  btn.disabled  = !(hasTask && hasTabs);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER — TRACKING VIEW
═══════════════════════════════════════════════════════════════════════════ */
function renderTracking() {
  renderStatusPill();
  renderTimers();
  renderTabStatusBar();
  renderBreakdown();
  renderRegisteredMini();
  renderHeatmap();
  renderOffTabLog();
}

function renderStatusPill() {
  const pill = $("statusPill");
  const text = $("statusText");
  if (!pill) return;

  pill.className = "status-pill";

  if (state.systemIdle) {
    pill.classList.add("idle");
    text.textContent = "System idle — verified clock paused";
  } else if (state.activityIdle) {
    pill.classList.add("idle");
    text.textContent = "No activity detected — verified clock paused";
  } else if (!state.onRegisteredTab) {
    pill.classList.add("off-tab");
    text.textContent = `Off project tab — clock paused`;
  } else {
    pill.classList.add("counting");
    text.textContent = `Counting verified time on ${state.activeTabDomain || "project tab"}`;
  }

  const tb = document.querySelector(".timer-block");
  if (tb) {
    tb.className = "timer-block";
    if (state.clockRunning)                                 tb.classList.add("counting");
    else if (state.systemIdle || state.activityIdle)        tb.classList.add("idle");
    else                                                    tb.classList.add("off-tab");
  }
}

function renderTimers() {
  const vEl = $("verifiedDisplay");
  if (vEl) vEl.textContent = fmtTime(state.verifiedSec);
  // Wall = sum of all three buckets
  const wallEl = $("wallDisplay");
  if (wallEl) wallEl.textContent = fmtTime(state.verifiedSec + state.offTabSec + state.idleSec);
}

function renderTabStatusBar() {
  const bar    = $("tabStatusBar");
  const icon   = $("tabStatusIcon");
  const domain = $("tabStatusDomain");
  const sub    = $("tabStatusSub");
  if (!bar) return;

  bar.className = "tab-status-bar";

  if (state.systemIdle) {
    bar.classList.add("idle");
    icon.textContent   = "⏸";
    domain.textContent = "System idle";
    sub.textContent    = "Move mouse or press a key to resume";
  } else if (state.activityIdle) {
    bar.classList.add("idle");
    icon.textContent   = "⏸";
    domain.textContent = state.activeTabDomain || "Project tab";
    sub.textContent    = "No activity detected — move mouse to resume";
  } else if (state.onRegisteredTab) {
    bar.classList.add("on-tab");
    icon.textContent   = "✓";
    domain.textContent = state.activeTabDomain || "Project tab";
    const reg = state.registeredTabs.find(t => t.domain === state.activeTabDomain);
    sub.textContent    = reg ? `Registered · ${reg.title}` : "Registered project tab";
  } else {
    bar.classList.add("off-tab");
    icon.textContent   = "→";
    domain.textContent = state.activeTabDomain || "Other tab";
    sub.textContent    = "Not a project tab — clock paused";
  }
}

function renderBreakdown() {
  const wall = Math.max(1, state.verifiedSec + state.offTabSec + state.idleSec);
  const vPct = Math.round((state.verifiedSec / wall) * 100);
  const oPct = Math.round((state.offTabSec   / wall) * 100);
  const iPct = Math.round((state.idleSec     / wall) * 100);

  // Live WQI
  const active = state.verifiedSec + state.offTabSec;
  const focusR = active > 0 ? state.verifiedSec / active : 0;
  const sw     = state.unregisteredTabSwitches || 0;
  const cons   = sw <= 2 ? 1.0 : Math.max(0.35, 1 - (sw - 2) * 0.09);
  const wqi    = Math.min(100, Math.round((focusR * 0.45 + 0.76 * 0.30 + cons * 0.25) * 100));

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set("bkVerifiedPct", `${vPct}%`);
  set("bkOffTabPct",   `${oPct}%`);
  set("bkIdlePct",     `${iPct}%`);
  set("bkWqi",         wqi);
}

function renderRegisteredMini() {
  const el = $("registeredMini");
  if (!el) return;
  el.innerHTML = state.registeredTabs.map(t => {
    const active = t.domain === state.activeTabDomain && state.onRegisteredTab && state.clockRunning;
    return `<div class="mini-tab-chip ${active ? "active" : ""}">
      <div class="chip-dot"></div>${escHtml(t.domain)}
    </div>`;
  }).join("");
}

function renderHeatmap() {
  const el     = $("miniHeatmap");
  const blocks = state.activityBlocks || [];
  if (!el) return;
  el.innerHTML = "";
  for (let h = 0; h < 24; h++) {
    const col = document.createElement("div");
    col.className = "heat-col";
    for (let b = 0; b < 3; b++) {
      const blk  = blocks.find(x => x.hour === h && x.block === b);
      const cell = document.createElement("div");
      cell.className = "heat-cell";
      if (blk) {
        cell.style.background = heatColor(blk);
        cell.title = `${h}:${String(b*5).padStart(2,"0")} — verified: ${blk.verifiedSec||0}s`;
      }
      col.appendChild(cell);
    }
    el.appendChild(col);
  }
}

function renderOffTabLog() {
  const events = state.offTabEvents || [];
  const badge  = $("offTabCount");
  const list   = $("offTabList");
  if (!badge || !list) return;

  badge.textContent = events.length;
  badge.className   = "count-badge" + (events.length === 0 ? " zero" : "");

  list.innerHTML = events.length === 0
    ? `<div class="empty-state" style="padding:10px 12px;font-size:12px">None yet — great focus!</div>`
    : events.map(e => `
        <div class="off-tab-item">
          <span class="off-tab-domain">${escHtml(e.domain || "unknown")}</span>
          <span class="off-tab-dur">${fmtDur(e.durationSec)}</span>
        </div>`).join("");
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER ALL
═══════════════════════════════════════════════════════════════════════════ */
function renderAll() {
  renderSetup();
  renderTracking();
  renderDeepWorkBtn();
  if (state.isRunning) showView("tracking");
}

function renderDeepWorkBtn() {
  const btn = $("deepWorkBtn");
  if (btn) btn.classList.toggle("active", state.deepWorkEnabled);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════════════════════════════════════ */
function bindAllEvents() {

  $("taskInput").addEventListener("input", () => { updateStartBtn(); debounceUpdateTask(); });
  $("clientInput").addEventListener("input", debounceUpdateTask);

  // Add current tab
  $("addCurrentTabBtn").addEventListener("click", async () => {
    hideSetupError();
    const res = await send("REGISTER_CURRENT_TAB");
    if (res?.entry) {
      state.registeredTabs = [...state.registeredTabs, res.entry];
      renderRegisteredList();
      updateStartBtn();
    } else {
      showSetupError("Could not register tab — make sure it's not a Chrome system page.");
    }
  });

  // Browse tabs
  $("browseTabsBtn").addEventListener("click", async () => {
    const picker = $("tabPicker");
    picker.classList.toggle("hidden");
    if (!picker.classList.contains("hidden")) await loadOpenTabs();
  });

  $("closePickerBtn").addEventListener("click", () => $("tabPicker").classList.add("hidden"));

  // Tags
  $$(".tag-opt").forEach(btn => btn.addEventListener("click", () => toggleTag(btn.dataset.tag)));

  // Start
  $("startSessionBtn").addEventListener("click", async () => {
    const task   = $("taskInput").value.trim();
    const client = $("clientInput").value.trim();
    if (!task) { $("taskInput").focus(); return; }
    if (state.registeredTabs.length === 0) { showSetupError("Register at least one project tab first."); return; }
    hideSetupError();
    await send("START_SESSION", { task, client, tags: [...selectedTags] });
    await syncFromWorker();
    showView("tracking");
    renderAll();
  });

  // Stop
  $("stopBtn").addEventListener("click", async () => {
    if (!confirm("Stop and save this session?")) return;
    await send("STOP_SESSION");
    await syncFromWorker();
    $("taskInput").value = "";
    $("clientInput").value = "";
    selectedTags = [];
    renderTagChips();
    setTimeout(() => { showView("sessions"); loadSessions(); }, 300);
  });

  // Adjust
  $("adjustBtn").addEventListener("click", () => {
    $("adjustMinutes").value = Math.round(state.verifiedSec / 60);
    $("adjustReason").value  = "";
    showView("adjust");
  });
  $("adjustBackBtn").addEventListener("click", () => showView("tracking"));
  $("adjustSaveBtn").addEventListener("click", async () => {
    const mins   = parseInt($("adjustMinutes").value, 10);
    const reason = $("adjustReason").value.trim();
    if (!reason) { $("adjustReason").style.borderColor = "var(--danger)"; setTimeout(() => $("adjustReason").style.borderColor = "", 1500); return; }
    await send("ADJUST_TIME", { newVerifiedSec: mins * 60, reason });
    await syncFromWorker();
    showView("tracking");
  });

  // Settings
  $("settingsBtn").addEventListener("click",     () => { showView("settings"); refreshAuthUI(); });
  $("settingsBackBtn").addEventListener("click",  () => showView(state.isRunning ? "tracking" : "setup"));

  $("deepWorkBtn").addEventListener("click", async () => {
    const val = !state.deepWorkEnabled;
    await send("SET_DEEP_WORK", { enabled: val });
    state.deepWorkEnabled = val;
    renderDeepWorkBtn();
  });

  $("deepWorkToggle").addEventListener("change", async e => {
    await send("SET_DEEP_WORK", { enabled: e.target.checked });
    state.deepWorkEnabled = e.target.checked;
  });

  $("clearSessionsBtn").addEventListener("click", async () => {
    if (!confirm("Clear all saved sessions?")) return;
    await send("CLEAR_SESSIONS");
    loadSessions();
  });

  $("clearAllBtn").addEventListener("click", async () => {
    if (!confirm("Clear ALL WorkRate data?")) return;
    await send("CLEAR_SESSIONS");
    await chrome.storage.local.clear();
    window.location.reload();
  });

  // Auth
  $("loginBtn").addEventListener("click",  doLogin);
  $("logoutBtn").addEventListener("click", doLogout);
  $("syncNowBtn").addEventListener("click", async () => {
    $("syncNowBtn").textContent = "Syncing…";
    $("syncNowBtn").disabled = true;
    await send("AUTH_DRAIN_QUEUE");
    await refreshAuthUI();
    $("syncNowBtn").textContent = "Sync now";
    $("syncNowBtn").disabled = false;
  });
  // Also enter on password field triggers login
  $("loginPassword").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

  // When settings opens, refresh auth state
  $("settingsBtn").addEventListener("click", refreshAuthUI, { capture: true });

  // Bottom nav
  document.querySelector('[data-view="setup"]').addEventListener("click", () =>
    showView(state.isRunning ? "tracking" : "setup")
  );
  document.querySelector('[data-view="sessions"]').addEventListener("click", () => {
    showView("sessions");
    loadSessions();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB PICKER
═══════════════════════════════════════════════════════════════════════════ */
async function loadOpenTabs() {
  const res  = await send("GET_OPEN_TABS");
  const tabs = res?.tabs || [];
  const list = $("openTabsList");
  if (!tabs.length) { list.innerHTML = `<div class="empty-state" style="padding:12px">No open tabs found.</div>`; return; }
  list.innerHTML = tabs.map(t => {
    const already = state.registeredTabs.some(r => r.tabId === t.tabId);
    return `
      <div class="open-tab-item ${already ? "already-added" : ""}" data-tabid="${t.tabId}">
        ${t.favicon ? `<img class="tab-favicon" src="${escHtml(t.favicon)}" onerror="this.style.display='none'"/>` : `<div class="tab-favicon-placeholder">◎</div>`}
        <div class="tab-info" style="flex:1;min-width:0">
          <div class="tab-domain">${escHtml(t.domain)}</div>
          <div class="tab-title">${escHtml(t.title)}</div>
        </div>
        <div class="tab-add-icon">${already ? "✓" : "+"}</div>
      </div>`;
  }).join("");
  list.querySelectorAll(".open-tab-item:not(.already-added)").forEach(item => {
    item.addEventListener("click", async () => {
      const res = await send("REGISTER_TAB", { tabId: parseInt(item.dataset.tabid) });
      if (res?.entry) {
        state.registeredTabs = [...state.registeredTabs, res.entry];
        renderRegisteredList();
        updateStartBtn();
        await loadOpenTabs();
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SESSIONS
═══════════════════════════════════════════════════════════════════════════ */
async function loadSessions() {
  const res      = await send("GET_SESSIONS");
  const sessions = res?.sessions || [];
  const list     = $("sessionsList");

  if (!sessions.length) {
    list.innerHTML = `<div class="empty-state">No sessions yet. Start your first timer!</div>`;
    return;
  }

  const wqiColor = w => w >= 85 ? "var(--accent)" : w >= 70 ? "var(--warn)" : "var(--danger)";

  list.innerHTML = sessions.slice(0, 30).map(s => `
    <div class="session-card" data-session-id="${s.id}" role="button" tabindex="0"
         title="Click to open in dashboard">
      <div class="session-row1">
        <div class="sess-dot" style="background:${wqiColor(s.wqi)}"></div>
        <div class="sess-task">${escHtml(s.task || "Untitled")}</div>
        <div class="sess-times">
          <div class="sess-verified">${s.verifiedFormatted || fmtDur(s.verifiedSec)}</div>
          <div class="sess-wall">of ${s.wallFormatted || fmtDur(s.wallSec)} total</div>
        </div>
      </div>
      <div class="sess-meta">${s.date || "Today"} · ${escHtml(s.client || "—")} · WQI ${s.wqi}</div>
      <div class="sess-pcts">
        <span class="sess-pct-pill v">✓ ${s.verifiedPct ?? "—"}% verified</span>
        <span class="sess-pct-pill o">→ ${s.offTabPct ?? "—"}% off-tab</span>
        <span class="sess-pct-pill i">⏸ ${s.idlePct ?? "—"}% idle</span>
      </div>
      ${s.registeredTabs?.length
        ? `<div style="font-size:10px;color:var(--muted);margin-top:6px">
             Tabs: ${s.registeredTabs.map(t => t.domain).join(", ")}
           </div>`
        : ""}
      <div class="sess-open-link">Open in dashboard ↗</div>
    </div>`).join("");

  // Bind click — opens dashboard at the exact session via hash deep-link
  list.querySelectorAll(".session-card[data-session-id]").forEach(card => {
    const openDashboard = () => {
      const id  = card.dataset.sessionId;
      const url = `${DASHBOARD_URL}#session-${id}`;
      chrome.tabs.create({ url });
    };
    card.addEventListener("click", openDashboard);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openDashboard(); });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAGS
═══════════════════════════════════════════════════════════════════════════ */
function toggleTag(tag) {
  if (selectedTags.includes(tag)) selectedTags = selectedTags.filter(t => t !== tag);
  else selectedTags.push(tag);
  renderTagChips();
}

function renderTagChips() {
  const list = $("tagsList");
  list.innerHTML = selectedTags.map(t => `
    <span class="tag-chip">${escHtml(t)}<span class="remove" data-tag="${t}">×</span></span>
  `).join("");
  list.querySelectorAll(".remove").forEach(r => r.addEventListener("click", () => toggleTag(r.dataset.tag)));
  $$(".tag-opt").forEach(btn => btn.classList.toggle("selected", selectedTags.includes(btn.dataset.tag)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
async function removeTab(tabId) {
  await send("UNREGISTER_TAB", { tabId });
  state.registeredTabs = state.registeredTabs.filter(t => t.tabId !== tabId);
  renderRegisteredList();
  updateStartBtn();
}

function showSetupError(msg) { const el = $("setupError"); el.textContent = msg; el.classList.remove("hidden"); }
function hideSetupError()    { $("setupError").classList.add("hidden"); }

function heatColor(blk) {
  if (!blk) return "var(--border-light)";
  if ((blk.idleSec||0) > blk.verifiedSec)   return "rgba(190,26,26,.15)";
  if ((blk.offTabSec||0) > blk.verifiedSec) return "rgba(184,82,14,.25)";
  const v = blk.intensity || 0;
  if (v === 0) return "var(--border-light)";
  if (v < 25)  return "rgba(27,122,80,.14)";
  if (v < 50)  return "rgba(27,122,80,.32)";
  if (v < 75)  return "rgba(27,122,80,.58)";
  return "rgba(27,122,80,.84)";
}

function fmtTime(sec) {
  if (!sec || sec < 0) sec = 0;
  return [
    String(Math.floor(sec/3600)).padStart(2,"0"),
    String(Math.floor((sec%3600)/60)).padStart(2,"0"),
    String(sec%60).padStart(2,"0"),
  ].join(":");
}

function fmtDur(sec) {
  if (!sec || sec < 0) return "0m";
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str ?? "");
  return d.innerHTML;
}

let _taskDeb;
function debounceUpdateTask() {
  clearTimeout(_taskDeb);
  _taskDeb = setTimeout(() => send("UPDATE_TASK", { task: $("taskInput").value.trim(), client: $("clientInput").value.trim() }), 600);
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH — Login / Logout / Sync status
   All heavy work is in background/api.js.
   These functions only drive the Settings view UI.
═══════════════════════════════════════════════════════════════════════════ */

async function refreshAuthUI() {
  const res = await send("AUTH_STATUS");
  const loggedIn = res?.loggedIn ?? false;

  $("authLoggedOut").classList.toggle("hidden",  loggedIn);
  $("authLoggedIn").classList.toggle("hidden",  !loggedIn);

  if (loggedIn && res.user) {
    $("authEmail").textContent = res.user.email ?? "—";
    $("authPlan").textContent  = `${capitalize(res.user.plan ?? "free")} plan`;
  }

  // Show offline queue banner if there are sessions waiting
  const qRes = await send("AUTH_QUEUE_STATUS");
  const qCount = qRes?.count ?? 0;
  const banner = $("syncBanner");
  if (banner) {
    banner.classList.toggle("hidden", qCount === 0);
    if (qCount > 0) {
      $("syncBannerText").textContent =
        `${qCount} session${qCount === 1 ? "" : "s"} waiting to sync`;
    }
  }
}

async function doLogin() {
  const email    = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const errEl    = $("loginError");

  errEl.classList.add("hidden");
  errEl.textContent = "";

  if (!email || !password) {
    errEl.textContent = "Email and password are required.";
    errEl.classList.remove("hidden");
    return;
  }

  const btn = $("loginBtn");
  btn.textContent = "Logging in…";
  btn.disabled    = true;

  const res = await send("AUTH_LOGIN", { email, password });

  btn.textContent = "Log in";
  btn.disabled    = false;

  if (res?.success) {
    $("loginEmail").value    = "";
    $("loginPassword").value = "";
    await refreshAuthUI();
  } else {
    errEl.textContent = res?.error ?? "Login failed. Check your credentials.";
    errEl.classList.remove("hidden");
  }
}

async function doLogout() {
  if (!confirm("Log out of WorkRate? Sessions will still be saved locally.")) return;
  await send("AUTH_LOGOUT");
  await refreshAuthUI();
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}
