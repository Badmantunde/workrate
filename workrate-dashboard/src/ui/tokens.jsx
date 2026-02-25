import React from "react";

// Design tokens and shared icon set for the dashboard UI

export const C = {
  bg: "#F7F6F3",
  surface: "#FFFFFF",
  borderLight: "#EEECE8",
  border: "#E3E0D9",
  text: "#18170F",
  sub: "#6A6760",
  muted: "#A5A29A",
  accent: "#1B7A50",
  accentLight: "#EDF6F1",
  accentBorder: "#BEE0CE",
  purple: "#6D28D9",
  purpleLight: "#F3F0FF",
  purpleBorder: "rgba(109,40,217,.25)",
  warn: "#B8520E",
  warnLight: "#FDF1E8",
  warnBorder: "rgba(184,82,14,.25)",
  danger: "#BE1A1A",
  dangerLight: "#FDEAEA",
  dangerBorder: "rgba(190,26,26,.25)",
  overlay: "rgba(24,23,15,0.4)",
};

export const wqiColor = (w) => (w >= 85 ? C.accent : w >= 70 ? C.warn : C.danger);

export const wqiLabel = (w) =>
  w >= 85 ? "Excellent" : w >= 70 ? "Good" : "Needs work";

export const heatFill = (v, idle) => {
  if (idle) return "rgba(190,26,26,0.12)";
  if (v === 0) return C.borderLight;
  if (v < 25) return "rgba(27,122,80,0.14)";
  if (v < 50) return "rgba(27,122,80,0.32)";
  if (v < 75) return "rgba(27,122,80,0.58)";
  return "rgba(27,122,80,0.84)";
};

export const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: "24px 26px",
};

export const LBL = {
  fontSize: 11,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: C.muted,
  fontWeight: 500,
  marginBottom: 10,
};

// SVG icons (no emojis)
export const Icon = {
  check: (size = 14) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M2 7l3 4 6-8" />
    </svg>
  ),
  cross: (size = 14) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  ),
  warn: (size = 14) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M7 4v4M7 9.5v.5" />
      <path d="M1.5 12L7 2l5.5 10H1.5z" />
    </svg>
  ),
  flame: (size = 20) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  target: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  chart: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </svg>
  ),
  star: (size = 18) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
    </svg>
  ),
  handshake: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 12h2m-2 2h2m-6-4h2m-2 2h2m4-6v2m0 8v2m-4-6h4m-4 2h6l2-4-2-4h-6m-4 2H8L6 8l2-4h4" />
    </svg>
  ),
  lightning: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
    </svg>
  ),
  run: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 5l6 6-6 6M5 5v14" />
    </svg>
  ),
  doc: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  chartBar: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 16v-5M12 16V9M17 16v-3" />
    </svg>
  ),
  clipboard: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  circleOn: (size = 18) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  circleOff: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  settings: (size = 18) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

export const btn = (v = "primary", extra = {}) => ({
  padding: "9px 20px",
  borderRadius: 9,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  transition: "all .15s",
  ...(v === "primary"
    ? { background: C.accent, color: "#fff" }
    : {}),
  ...(v === "ghost"
    ? { background: "transparent", color: C.sub, border: `1px solid ${C.border}` }
    : {}),
  ...(v === "accent"
    ? {
        background: C.accentLight,
        color: C.accent,
        border: `1px solid ${C.accentBorder}`,
      }
    : {}),
  ...(v === "danger"
    ? {
        background: C.dangerLight,
        color: C.danger,
        border: `1px solid ${C.dangerBorder}`,
      }
    : {}),
  ...(v === "purple"
    ? {
        background: C.purpleLight,
        color: C.purple,
        border: `1px solid ${C.purpleBorder}`,
      }
    : {}),
  ...extra,
});

export const inp = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  color: C.text,
  background: C.bg,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

