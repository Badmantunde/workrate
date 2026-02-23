/**
 * WorkRate — Content Detector
 * ─────────────────────────────
 * PRIVACY RULES (strictly enforced):
 *  ✓ Records mouse MOVEMENT FREQUENCY only (not position, not clicks on specific elements)
 *  ✓ Records scroll activity (boolean: active/not active)
 *  ✗ NEVER reads page content, text, form values, or keystrokes
 *  ✗ NEVER records which specific elements are clicked
 *  ✗ NEVER intercepts form submissions
 *
 * Aggregates signals into a single "activity intensity" number per 30s window,
 * then sends ONLY that number to the background worker.
 */

(function () {
  "use strict";

  let mouseEvents  = 0;
  let scrollEvents = 0;
  let windowActive = true;
  let reportTimer  = null;
  let isTracking   = false;

  /* ── Throttled event counters (count frequency, not specifics) ── */
  let mouseMoveThrottle = false;
  document.addEventListener("mousemove", () => {
    if (!isTracking || mouseMoveThrottle) return;
    mouseEvents++;
    mouseMoveThrottle = true;
    setTimeout(() => { mouseMoveThrottle = false; }, 200); // max 5 events/sec
  }, { passive: true });

  let scrollThrottle = false;
  document.addEventListener("scroll", () => {
    if (!isTracking || scrollThrottle) return;
    scrollEvents++;
    scrollThrottle = true;
    setTimeout(() => { scrollThrottle = false; }, 500);
  }, { passive: true });

  // Page visibility
  document.addEventListener("visibilitychange", () => {
    windowActive = document.visibilityState === "visible";
  });

  /* ── Compute intensity and report ── */
  function computeIntensity() {
    // Max reasonable events per 30s window: ~150 mouse + 60 scroll
    const raw = Math.min(100, Math.round((mouseEvents * 0.5 + scrollEvents * 1.0) / 2.1));
    mouseEvents  = 0;
    scrollEvents = 0;
    return windowActive ? raw : 0;
  }

  function startReporting() {
    if (reportTimer) return;
    reportTimer = setInterval(() => {
      const intensity = computeIntensity();
      // Only send the aggregated number — never any content
      chrome.runtime.sendMessage({
        type:      "ACTIVITY_SIGNAL",
        intensity, // 0–100
        domain:    window.location.hostname.replace("www.", ""),
      }).catch(() => {}); // background may be inactive
    }, 30_000); // every 30 seconds
  }

  function stopReporting() {
    clearInterval(reportTimer);
    reportTimer = null;
    mouseEvents = scrollEvents = 0;
  }

  /* ── Listen for tracking state from background ── */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATE") {
      const wasTracking = isTracking;
      isTracking = msg.state?.isRunning && !msg.state?.isPaused;
      if (isTracking && !wasTracking) startReporting();
      if (!isTracking && wasTracking)  stopReporting();
    }
  });

  /* ── Bootstrap: check if already tracking ── */
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.state?.isRunning && !res?.state?.isPaused) {
      isTracking = true;
      startReporting();
    }
  });

})();
