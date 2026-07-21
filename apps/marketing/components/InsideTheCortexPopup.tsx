"use client";

/**
 * InsideTheCortexPopup
 * apps/marketing/src/components/InsideTheCortexPopup.tsx
 *
 * Shows once on first visit (localStorage gated).
 * Collects: first name, last name, business email, state.
 * POSTs to: https://app.rapidcortex.us/api/marketing/lead
 *
 * Mount in apps/marketing/src/app/layout.tsx:
 *   import { InsideTheCortexPopup } from "@/components/InsideTheCortexPopup";
 *   ...
 *   <body>
 *     {children}
 *     <InsideTheCortexPopup />
 *   </body>
 */

import { useState, useEffect, useCallback } from "react";
import { buildMarketingLeadRequestBody } from "rapid-cortex-shared";

const STORAGE_KEY = "rc_cortex_joined";
const APPEAR_DELAY_MS = 2500;
const API_BASE = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.rapidcortex.us";

/** Default on when unset (matches platform feature-flag policy). */
function isInsideTheCortexEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ENABLE_INSIDE_THE_CORTEX?.trim().toLowerCase();
  if (v === undefined || v === "") return true;
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

type ViewState = "hidden" | "form" | "submitting" | "success";

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  state: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  state?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InsideTheCortexPopup() {
  const [view, setView]       = useState<ViewState>("hidden");
  const [values, setValues]   = useState<FormValues>({ firstName: "", lastName: "", email: "", state: "" });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");

  // Show popup after delay if not already captured
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isInsideTheCortexEnabled()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setView("form"), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    setView("hidden");
  }, []);

  // ESC to close
  useEffect(() => {
    if (view === "hidden") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [view, dismiss]);

  // Prevent body scroll when open
  useEffect(() => {
    if (view === "hidden") {
      document.body.style.overflow = "";
    } else {
      document.body.style.overflow = "hidden";
    }
    return () => { document.body.style.overflow = ""; };
  }, [view]);

  const handleChange = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    setApiError(null);
  };

  const handleSubmit = async () => {
    const built = buildMarketingLeadRequestBody(values, {
      referrer: document.referrer || null,
      landingPage: `${window.location.pathname}${window.location.search}`,
      capturedAt: new Date().toISOString(),
    });
    if (!built.ok) {
      setErrors(built.fieldErrors);
      return;
    }

    setView("submitting");
    setApiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/marketing/lead`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(built.body),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      localStorage.setItem(STORAGE_KEY, "1");
      setFirstName(built.body.firstName);
      setView("success");

    } catch (err) {
      console.error("[InsideTheCortex] submit error:", err);
      setApiError("Something went wrong. Please try again.");
      setView("form");
    }
  };

  if (view === "hidden") return null;

  return (
    // Backdrop
    <div
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(4,8,18,0.88)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "rcFadeIn 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes rcFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rcSlideUp { from { transform: translateY(20px); opacity: 0; }
                               to   { transform: translateY(0);    opacity: 1; } }
        @keyframes rcSpin    { to { transform: rotate(360deg); } }
        @keyframes rcScaleIn { from { transform: scale(0.7); opacity: 0; }
                               to   { transform: scale(1);   opacity: 1; } }
        @keyframes rcBlink   { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rc-popup-title"
        style={{
          width: "100%", maxWidth: "460px",
          background: "#101c32",
          border: "1px solid #1b2b47",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          animation: "rcSlideUp 0.25s ease-out",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* ── Success state ── */}
        {view === "success" && (
          <SuccessView firstName={firstName} onClose={() => setView("hidden")} />
        )}

        {/* ── Form / Submitting state ── */}
        {(view === "form" || view === "submitting") && (
          <>
            {/* Header */}
            <div style={{
              background: "#0c1428",
              padding: "24px 28px 22px",
              borderBottom: "1px solid #1b2b47",
              position: "relative",
            }}>
              <button
                onClick={dismiss}
                aria-label="Close"
                style={{
                  position: "absolute", top: "14px", right: "14px",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "#334466", fontSize: "18px", lineHeight: 1, padding: "4px",
                  borderRadius: "4px",
                }}
              >
                ✕
              </button>

              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "20px", padding: "3px 10px 3px 6px",
                marginBottom: "14px",
              }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "#3b82f6", display: "inline-block",
                  animation: "rcBlink 1.8s ease-in-out infinite",
                }} />
                <span style={{ fontSize: "10px", fontWeight: 500, color: "#93c5fd", letterSpacing: "0.07em" }}>
                  INSIDE THE CORTEX
                </span>
              </div>

              <h2 id="rc-popup-title" style={{
                fontSize: "22px", fontWeight: 500, color: "#dce6f5",
                lineHeight: 1.2, marginBottom: "6px",
              }}>
                Welcome to{" "}
                <span style={{ color: "#3b82f6" }}>Rapid Cortex</span>
              </h2>
              <p style={{ fontSize: "13px", color: "#6b83a8", margin: 0 }}>
                Intelligence at the speed of response.
              </p>
            </div>

            {/* Body */}
            <div style={{ padding: "22px 28px 26px" }}>
              <p style={{
                fontSize: "13px", color: "#6b83a8", lineHeight: 1.65,
                marginBottom: "20px", paddingBottom: "20px",
                borderBottom: "1px solid #1b2b47",
              }}>
                Emergency communications is changing fast. We&apos;re at the center
                of it — and we want you there too.{" "}
                <strong style={{ color: "#dce6f5", fontWeight: 500 }}>Inside the Cortex</strong>{" "}
                is where we share what we&apos;re building, what we&apos;re learning, and
                where public safety technology is heading. No fluff. Just signal
                from the people building it.
              </p>

              {/* First + Last */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <Field
                  label="First name"
                  value={values.firstName}
                  placeholder="Jane"
                  error={errors.firstName}
                  disabled={view === "submitting"}
                  onChange={handleChange("firstName")}
                />
                <Field
                  label="Last name"
                  value={values.lastName}
                  placeholder="Smith"
                  error={errors.lastName}
                  disabled={view === "submitting"}
                  onChange={handleChange("lastName")}
                />
              </div>

              <Field
                label="Business email"
                type="email"
                value={values.email}
                placeholder="jane@youragency.gov"
                error={errors.email}
                disabled={view === "submitting"}
                onChange={handleChange("email")}
                style={{ marginBottom: "10px" }}
              />

              <Field
                label="State"
                value={values.state}
                placeholder="e.g. Louisiana"
                error={errors.state}
                disabled={view === "submitting"}
                onChange={handleChange("state")}
                style={{ marginBottom: 0 }}
              />

              {/* API error */}
              {apiError && (
                <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "10px" }}>
                  {apiError}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={view === "form" ? handleSubmit : undefined}
                disabled={view === "submitting"}
                style={{
                  width: "100%", height: "42px", marginTop: "18px",
                  background: view === "submitting" ? "#1d4ed8" : "#3b82f6",
                  border: "none", borderRadius: "5px",
                  cursor: view === "submitting" ? "default" : "pointer",
                  fontSize: "13px", fontWeight: 500, color: "#fff",
                  letterSpacing: "0.03em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "background 0.15s",
                }}
              >
                {view === "submitting" ? (
                  <>
                    <span style={{
                      width: "14px", height: "14px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", borderRadius: "50%",
                      animation: "rcSpin 0.7s linear infinite",
                      display: "inline-block",
                    }} />
                    Locking you in…
                  </>
                ) : (
                  <>→ Get inside the Cortex</>
                )}
              </button>

              <p style={{
                marginTop: "12px", textAlign: "center",
                fontSize: "10px", color: "#334466",
              }}>
                We don&apos;t sell your information. Unsubscribe anytime.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, type = "text", value, placeholder, error, disabled, onChange, style,
}: {
  label: string; type?: string; value: string; placeholder: string;
  error?: string; disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: "10px", ...style }}>
      <label style={{
        display: "block", fontSize: "10px", fontWeight: 500,
        color: "#334466", letterSpacing: "0.08em",
        marginBottom: "5px",
      }}>
        {label.toUpperCase()}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        style={{
          width: "100%", height: "38px", padding: "0 12px",
          background: "#0c1428",
          border: `1px solid ${error ? "#ef4444" : "#1b2b47"}`,
          borderRadius: "5px",
          fontSize: "13px", color: "#dce6f5",
          outline: "none",
          fontFamily: "inherit",
          opacity: disabled ? 0.6 : 1,
        }}
      />
      {error && (
        <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "3px" }}>{error}</p>
      )}
    </div>
  );
}

function SuccessView({ firstName, onClose }: { firstName: string; onClose: () => void }) {
  return (
    <>
      <div style={{
        background: "#0c1428",
        padding: "18px 28px 16px",
        borderBottom: "1px solid #1b2b47",
        position: "relative",
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: "14px", right: "14px",
            background: "transparent", border: "none", cursor: "pointer",
            color: "#334466", fontSize: "18px", lineHeight: 1, padding: "4px",
            borderRadius: "4px",
          }}
        >
          ✕
        </button>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "20px", padding: "3px 10px 3px 6px",
        }}>
          <span style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#22c55e", display: "inline-block",
          }} />
          <span style={{ fontSize: "10px", fontWeight: 500, color: "#86efac", letterSpacing: "0.07em" }}>
            YOU&apos;RE IN
          </span>
        </div>
      </div>

      <div style={{
        padding: "36px 28px 40px",
        textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{
          width: "52px", height: "52px", borderRadius: "50%",
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", color: "#22c55e",
          marginBottom: "18px",
          animation: "rcScaleIn 0.3s ease-out",
        }}>
          ✓
        </div>
        <h3 style={{ fontSize: "18px", fontWeight: 500, color: "#dce6f5", marginBottom: "10px" }}>
          You&apos;re inside the Cortex.
        </h3>
        <p style={{ fontSize: "13px", color: "#6b83a8", lineHeight: 1.65, maxWidth: "300px" }}>
          {firstName ? `We'll be in touch, ${firstName}.` : "We'll be in touch."}{" "}
          Expect real updates from the people building the next generation
          of public safety intelligence.
        </p>
        <div style={{
          marginTop: "22px",
          background: "rgba(59,130,246,0.1)",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: "20px", padding: "5px 16px",
          fontSize: "11px", color: "#93c5fd", letterSpacing: "0.05em",
        }}>
          First dispatch coming soon
        </div>
      </div>
    </>
  );
}
