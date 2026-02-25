import React, { useEffect } from "react";
import { C, LBL, Icon, btn, inp, card, wqiColor } from "./tokens";

export function Tag({ children, onRemove }) {
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 500,
        background: C.accentLight,
        color: C.accent,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {children}
      {onRemove && (
        <span
          onClick={onRemove}
          style={{
            cursor: "pointer",
            opacity: 0.6,
            lineHeight: 1,
          }}
        >
          ×
        </span>
      )}
    </span>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: C.sub,
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{hint}</p>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.overlay,
        padding: 20,
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: C.surface,
          borderRadius: 16,
          width: "100%",
          maxWidth: width,
          boxShadow: "0 24px 60px rgba(0,0,0,.18)",
          my: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 24px",
            borderBottom: `1px solid ${C.borderLight}`,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.text,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: C.muted,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const colors = {
    success: [C.accentLight, C.accent, C.accentBorder],
    error: [C.dangerLight, C.danger, C.dangerBorder],
    warn: [C.warnLight, C.warn, C.warnBorder],
  };
  const [bg, co, bd] = colors[type] || colors.success;
  const icon =
    type === "success"
      ? Icon.check(16)
      : type === "error"
      ? Icon.cross(16)
      : Icon.warn(16);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 2000,
        background: bg,
        color: co,
        border: `1px solid ${bd}`,
        borderRadius: 10,
        padding: "12px 18px",
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "0 8px 24px rgba(0,0,0,.10)",
        animation: "wr-slidein .25s ease",
        maxWidth: 340,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
      <span>{message}</span>
    </div>
  );
}

export function ProgressBar({ value, color = C.accent, height = 6 }) {
  return (
    <div
      style={{
        height,
        background: C.borderLight,
        borderRadius: 99,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, value)}%`,
          background: color,
          borderRadius: 99,
          transition: "width .8s cubic-bezier(.16,1,.3,1)",
        }}
      />
    </div>
  );
}

// Re-export commonly used style helpers to avoid deep imports in callers
export { card, LBL, Icon, btn, inp, wqiColor };

