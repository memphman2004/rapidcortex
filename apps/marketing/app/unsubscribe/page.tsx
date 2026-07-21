"use client";

/**
 * Unsubscribe page — apps/marketing/src/app/unsubscribe/page.tsx
 *
 * Reads ?token= from the URL, POSTs to the unsubscribe Lambda,
 * and shows a confirmation. Works as a static export (client-side only).
 *
 * URL format: https://www.rapidcortex.us/unsubscribe?token={uuid}
 */

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.rapidcortex.us";

type PageState = "loading" | "confirming" | "processing" | "success" | "already" | "error";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#060c1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,

  card: {
    width: "100%",
    maxWidth: "440px",
    background: "#0c1428",
    border: "1px solid #1b2b47",
    borderRadius: "12px",
    overflow: "hidden",
  } as React.CSSProperties,

  header: {
    background: "#060c1a",
    padding: "18px 28px",
    borderBottom: "1px solid #1b2b47",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  logo: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#93c5fd",
    letterSpacing: "0.12em",
  } as React.CSSProperties,

  body: {
    padding: "32px 28px 36px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  icon: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    margin: "0 auto 20px",
  } as React.CSSProperties,

  title: {
    fontSize: "18px",
    fontWeight: 500,
    color: "#dce6f5",
    marginBottom: "10px",
  } as React.CSSProperties,

  sub: {
    fontSize: "13px",
    color: "#6b83a8",
    lineHeight: 1.65,
    maxWidth: "320px",
    margin: "0 auto 24px",
  } as React.CSSProperties,

  btn: (variant: "primary" | "ghost") => ({
    height: "40px",
    padding: "0 20px",
    borderRadius: "5px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    border: variant === "primary" ? "none" : "1px solid #1b2b47",
    background: variant === "primary" ? "#3b82f6" : "transparent",
    color: variant === "primary" ? "#fff" : "#6b83a8",
  }) as React.CSSProperties,

  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(59,130,246,0.2)",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "rcSpin 0.8s linear infinite",
    margin: "0 auto 16px",
  } as React.CSSProperties,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function UnsubscribePage() {
  const [state, setState] = useState<PageState>("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token")?.trim() ?? null;
    setToken(t);
    setState(t ? "confirming" : "error");
  }, []);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setState("processing");

    try {
      const res = await fetch(`${API_BASE}/api/marketing/unsubscribe`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ token }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("success");
    } catch (err) {
      console.error("[unsubscribe]", err);
      setState("error");
    }
  };

  return (
    <div style={S.page}>
      <style>{`@keyframes rcSpin { to { transform: rotate(360deg); } }`}</style>

      <div style={S.card}>

        {/* Header */}
        <div style={S.header}>
          <span style={S.logo}>RAPID CORTEX</span>
          <span style={{ fontSize: "10px", color: "#334466", letterSpacing: "0.05em" }}>
            Inside the Cortex
          </span>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* Loading */}
          {state === "loading" && (
            <>
              <div style={S.spinner} />
              <p style={S.sub}>Loading…</p>
            </>
          )}

          {/* Confirm */}
          {state === "confirming" && (
            <>
              <div style={{ ...S.icon, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <span style={{ fontSize: "22px" }}>✕</span>
              </div>
              <h1 style={S.title}>Unsubscribe from Inside the Cortex?</h1>
              <p style={S.sub}>
                You won&apos;t receive any more updates from us. You can always sign up again
                at rapidcortex.us if you change your mind.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <a href="https://www.rapidcortex.us" style={{ textDecoration: "none" }}>
                  <button style={S.btn("ghost")}>Keep me in</button>
                </a>
                <button onClick={() => void handleUnsubscribe()} style={S.btn("primary")}>
                  Yes, unsubscribe
                </button>
              </div>
            </>
          )}

          {/* Processing */}
          {state === "processing" && (
            <>
              <div style={S.spinner} />
              <p style={{ ...S.title, fontSize: "15px" }}>Processing…</p>
            </>
          )}

          {/* Success */}
          {state === "success" && (
            <>
              <div style={{ ...S.icon, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
                ✓
              </div>
              <h1 style={S.title}>You&apos;ve been unsubscribed.</h1>
              <p style={S.sub}>
                We&apos;re sorry to see you go. You won&apos;t hear from us again — unless
                you sign up at the site and we hope one day you will.{" "}
                Thank you for the time you gave us.
              </p>
              <a href="https://www.rapidcortex.us" style={{ textDecoration: "none" }}>
                <button style={S.btn("ghost")}>Back to rapidcortex.us</button>
              </a>
            </>
          )}

          {/* Error / invalid token */}
          {state === "error" && (
            <>
              <div style={{ ...S.icon, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                !
              </div>
              <h1 style={S.title}>Something went wrong.</h1>
              <p style={S.sub}>
                This unsubscribe link may have expired or already been used.
                If you still want to unsubscribe, email us at{" "}
                <a href="mailto:hello@rapidcortex.us" style={{ color: "#3b82f6" }}>
                  hello@rapidcortex.us
                </a>{" "}
                and we'll take care of it right away.
              </p>
              <a href="https://www.rapidcortex.us" style={{ textDecoration: "none" }}>
                <button style={S.btn("ghost")}>Back to rapidcortex.us</button>
              </a>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
