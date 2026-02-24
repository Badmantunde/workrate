/**
 * WorkRate — Content Detector
 * ─────────────────────────────
 * PRIVACY RULES (strictly enforced):
 *  ✓ Records mouse MOVEMENT FREQUENCY only
 *  ✓ Records scroll activity (boolean)
 *  ✗ NEVER reads page content, text, form values, or keystrokes
 *
 * Dashboard bridge (WorkRate pages only):
 *  - WR_GET_TABS_REQUEST  → fetches real open tabs from worker → posts back
 *  - WR_SET_DEEP_WORK     → forwards to worker immediately
 *  - wr_ext_handshake     → auth token pickup from localStorage
 *  - wr_dashboard_session → session start/stop mirror
 */

(function () {
  "use strict";

  const isDashboard = window.location.hostname.includes("workrate") ||
                      window.location.hostname === "localhost" ||
                      window.location.hostname === "127.0.0.1";

  if (isDashboard) {

    window.addEventListener("message", (e) => {
      if (e.source !== window) return;

      if (e.data?.type === "WR_GET_TABS_REQUEST") {
        chrome.runtime.sendMessage({ type: "GET_OPEN_TABS" }, (res) => {
          if (chrome.runtime.lastError || !res?.success) {
            window.postMessage({ type: "WR_GET_TABS_RESPONSE", tabs: [] }, "*");
            return;
          }
          window.postMessage({ type: "WR_GET_TABS_RESPONSE", tabs: res.tabs }, "*");
        });
      }

      if (e.data?.type === "WR_SET_DEEP_WORK") {
        chrome.runtime.sendMessage({
          type: "SET_DEEP_WORK",
          payload: {
            enabled:   !!e.data.enabled,
            blockList: Array.isArray(e.data.blockList) ? e.data.blockList : null,
          },
        }, () => { if (chrome.runtime.lastError) return; });
      }
    });

    function checkHandshake() {
      try {
        const raw = localStorage.getItem("wr_ext_handshake");
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data?.accessToken || Date.now() - (data.ts || 0) > 600_000) return;
        chrome.runtime.sendMessage({
          type: "DASHBOARD_AUTH",
          tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
          user:   data.user,
        }, () => { if (chrome.runtime.lastError) return; localStorage.removeItem("wr_ext_handshake"); });
      } catch (_) {}
    }

    let lastSessionTs = 0;
    function checkDashboardSession() {
      try {
        const raw = localStorage.getItem("wr_dashboard_session");
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data?.type || data.ts <= lastSessionTs) return;
        lastSessionTs = data.ts;
        if (data.type === "SESSION_START") {
          chrome.runtime.sendMessage({ type: "DASHBOARD_SESSION_START", payload: data.payload },
            () => { if (chrome.runtime.lastError) return; });
        }
        if (data.type === "SESSION_STOP") {
          chrome.runtime.sendMessage({ type: "DASHBOARD_SESSION_STOP" },
            () => { if (chrome.runtime.lastError) return; });
        }
      } catch (_) {}
    }

    checkHandshake();
    checkDashboardSession();
    // Poll every 2 seconds for faster sync (dashboard writes to localStorage, we read it)
    setInterval(() => { checkHandshake(); checkDashboardSession(); }, 2_000);
  }

  /* ── Activity detection (all pages) ─────────────────────────────── */
  let mouseEvents = 0, scrollEvents = 0, windowActive = true;
  let reportTimer = null, isTracking = false;

  let mmThrottle = false;
  document.addEventListener("mousemove", () => {
    if (!isTracking || mmThrottle) return;
    mouseEvents++; mmThrottle = true;
    setTimeout(() => { mmThrottle = false; }, 200);
  }, { passive: true });

  let scThrottle = false;
  document.addEventListener("scroll", () => {
    if (!isTracking || scThrottle) return;
    scrollEvents++; scThrottle = true;
    setTimeout(() => { scThrottle = false; }, 500);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    windowActive = document.visibilityState === "visible";
  });

  function computeIntensity() {
    const raw = Math.min(100, Math.round((mouseEvents * 0.5 + scrollEvents * 1.0) / 2.1));
    mouseEvents = scrollEvents = 0;
    return windowActive ? raw : 0;
  }

  function startReporting() {
    if (reportTimer) return;
    reportTimer = setInterval(() => {
      const intensity = computeIntensity();
      chrome.runtime.sendMessage({
        type: "ACTIVITY_SIGNAL", intensity,
        domain: window.location.hostname.replace("www.", ""),
      }).catch(() => {});
    }, 30_000);
  }

  function stopReporting() {
    clearInterval(reportTimer); reportTimer = null;
    mouseEvents = scrollEvents = 0;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "STATE_UPDATE") return;
    const wasTracking = isTracking;
    isTracking = msg.state?.isRunning && !msg.state?.isPaused;
    if (isTracking && !wasTracking) startReporting();
    if (!isTracking && wasTracking) stopReporting();
  });

  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.state?.isRunning && !res?.state?.isPaused) { isTracking = true; startReporting(); }
  });

})();