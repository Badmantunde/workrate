/**
 * WorkRate — Shared Constants
 * ────────────────────────────
 * Single source of truth for all config values used across
 * the service worker, popup, and content scripts.
 */

export const STORAGE_KEYS = {
  STATE:    "workrate_state",
  SESSIONS: "workrate_sessions",
  PROJECTS: "workrate_projects",   // saved project → registered tabs mappings
  SETTINGS: "workrate_settings",
};

/**
 * Seconds of system inactivity (no mouse/keyboard) before chrome.idle
 * fires. This catches "walked away from computer" scenarios.
 * Min value Chrome allows: 15 seconds.
 */
export const IDLE_THRESHOLD_SEC = 120; // 2 minutes

/**
 * If the user is ON a registered tab but has no mouse/keyboard
 * activity for this long, we also mark it as idle.
 * Separate from chrome.idle — catches "staring at screen, not working".
 */
export const TAB_ACTIVITY_IDLE_SEC = 180; // 3 minutes

/**
 * How often (ms) the heartbeat alarm fires to tick the timer
 * and record heatmap blocks. Chrome minimum is 1 minute for
 * persistent alarms; we use onAlarm + Date math to be accurate.
 */
export const HEARTBEAT_INTERVAL_MIN = 0.5; // every 30 seconds

/**
 * Domains blocked during Deep Work Mode.
 */
export const DISTRACTING_DOMAINS = [
  "twitter.com", "x.com", "reddit.com", "youtube.com",
  "instagram.com", "facebook.com", "tiktok.com",
  "twitch.tv", "linkedin.com", "news.ycombinator.com",
];

/**
 * WQI formula weights.
 * Must sum to 1.0.
 * Admin-adjustable in the SaaS dashboard (synced via API in Phase 2).
 */
export const WQI_WEIGHTS = {
  focus:       0.45,  // % of session time on registered tabs & not idle
  output:      0.30,  // output signals (commits, tasks) — placeholder 0.76
  consistency: 0.25,  // penalises frequent off-tab switches
};

export const VERSION = "1.1.0";
