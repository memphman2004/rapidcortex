"use client";

/**
 * Unsubscribe page — apps/marketing/app/unsubscribe/page.tsx
 *
 * Token flow:  https://www.nexcortiq.us/unsubscribe?token={uuid}
 * Bare link:   https://www.nexcortiq.us/unsubscribe  (email form — Instantly / sequence opt-out)
 */

import { useState, useEffect, type FormEvent } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ?? "https://app.rapidcortex.us";

type PageState =
  | "loading"
  | "confirming"
  | "email_form"
  | "processing"
  | "success"
  | "error";

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

  input: {
    width: "100%",
    height: "40px",
    padding: "0 12px",
    borderRadius: "5px",
    border: "1px solid #1b2b47",
    background: "#060c1a",
    color: "#dce6f5",
    fontSize: "13px",
    marginBottom: "12px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  btn: (variant: "primary" | "ghost") =>
    ({
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

export default function UnsubscribePage() {
  const [state, setState] = useState<PageState>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token")?.trim() ?? null;
    setToken(t);
    setState(t ? "confirming" : "email_form");
  }, []);

  const postUnsubscribe = async (body: { token: string } | { email: string }) => {
    setState("processing");
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/unsubscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setState("success");
    } catch (err) {
      console.error("[unsubscribe]", err);
      setFormError(err instanceof Error ? err.message : "Request failed");
      setState(token ? "error" : "email_form");
    }
  };

  const handleTokenUnsubscribe = () => {
    if (!token) return;
    void postUnsubscribe({ token });
  };

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError("Enter a valid email address.");
      return;
    }
    void postUnsubscribe({ email: trimmed });
  };

  return (
    <div style={S.page}>
      <style>{`@keyframes rcSpin { to { transform: rotate(360deg); } }`}</style>

      <div style={S.card}>
        <div style={S.header}>
          <span style={S.logo}>NEXCORT IQ</span>
          <span style={{ fontSize: "10px", color: "#334466", letterSpacing: "0.05em" }}>
            Inside iQ
          </span>
        </div>

        <div style={S.body}>
          {state === "loading" && (
            <>
              <div style={S.spinner} />
              <p style={S.sub}>Loading…</p>
            </>
          )}

          {state === "confirming" && (
            <>
              <div
                style={{
                  ...S.icon,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <span style={{ fontSize: "22px" }}>✕</span>
              </div>
              <h1 style={S.title}>Unsubscribe from Inside iQ?</h1>
              <p style={S.sub}>
                You won&apos;t receive any more updates from us. You can always sign up again at
                nexcortiq.us if you change your mind.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <a href="https://www.nexcortiq.us" style={{ textDecoration: "none" }}>
                  <button type="button" style={S.btn("ghost")}>
                    Keep me in
                  </button>
                </a>
                <button type="button" onClick={handleTokenUnsubscribe} style={S.btn("primary")}>
                  Yes, unsubscribe
                </button>
              </div>
            </>
          )}

          {state === "email_form" && (
            <>
              <div
                style={{
                  ...S.icon,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  color: "#3b82f6",
                }}
              >
                ✉
              </div>
              <h1 style={S.title}>Unsubscribe from NexCort iQ emails</h1>
              <p style={S.sub}>
                Enter the email address that receives our messages and we&apos;ll remove you from
                the list.
              </p>
              <form onSubmit={handleEmailSubmit} style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
                <label htmlFor="unsub-email" style={{ display: "block", fontSize: 12, color: "#6b83a8", marginBottom: 6 }}>
                  Email
                </label>
                <input
                  id="unsub-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@agency.gov"
                  style={S.input}
                />
                {formError && (
                  <p style={{ color: "#f87171", fontSize: 12, margin: "0 0 12px" }}>{formError}</p>
                )}
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <a href="https://www.nexcortiq.us" style={{ textDecoration: "none" }}>
                    <button type="button" style={S.btn("ghost")}>
                      Cancel
                    </button>
                  </a>
                  <button type="submit" style={S.btn("primary")}>
                    Unsubscribe
                  </button>
                </div>
              </form>
              <p style={{ ...S.sub, marginTop: 20, marginBottom: 0 }}>
                Or email{" "}
                <a href="mailto:hello@nexcortiq.us" style={{ color: "#3b82f6" }}>
                  hello@nexcortiq.us
                </a>
              </p>
            </>
          )}

          {state === "processing" && (
            <>
              <div style={S.spinner} />
              <p style={{ ...S.title, fontSize: "15px" }}>Processing…</p>
            </>
          )}

          {state === "success" && (
            <>
              <div
                style={{
                  ...S.icon,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  color: "#22c55e",
                }}
              >
                ✓
              </div>
              <h1 style={S.title}>You&apos;ve been unsubscribed.</h1>
              <p style={S.sub}>
                We&apos;re sorry to see you go. You won&apos;t hear from us again — unless you sign
                up at the site and we hope one day you will. Thank you for the time you gave us.
              </p>
              <a href="https://www.nexcortiq.us" style={{ textDecoration: "none" }}>
                <button type="button" style={S.btn("ghost")}>
                  Back to nexcortiq.us
                </button>
              </a>
            </>
          )}

          {state === "error" && (
            <>
              <div
                style={{
                  ...S.icon,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444",
                }}
              >
                !
              </div>
              <h1 style={S.title}>Something went wrong.</h1>
              <p style={S.sub}>
                This unsubscribe link may have expired or already been used. If you still want to
                unsubscribe, enter your email{" "}
                <button
                  type="button"
                  onClick={() => setState("email_form")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#3b82f6",
                    cursor: "pointer",
                    padding: 0,
                    font: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  here
                </button>{" "}
                or email{" "}
                <a href="mailto:hello@nexcortiq.us" style={{ color: "#3b82f6" }}>
                  hello@nexcortiq.us
                </a>
                .
              </p>
              <a href="https://www.nexcortiq.us" style={{ textDecoration: "none" }}>
                <button type="button" style={S.btn("ghost")}>
                  Back to nexcortiq.us
                </button>
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
