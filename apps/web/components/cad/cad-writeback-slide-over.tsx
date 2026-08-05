"use client";

/**
 * CadWritebackSlideOver
 *
 * Phase 6 — Dispatcher "Send to CAD" slide-over.
 *
 * This is the highest-stakes action in the dispatcher workflow.
 * Design principles:
 *  - Amber left border accent: intentional action, not danger, not routine
 *  - Narrative dominates the form — it is the write-back
 *  - Mandatory attestation checkbox before submit — forces a deliberate pause
 *  - Post-submit shifts into a "Pending" view with approvalId and elapsed timer
 *  - No auto-close on submit — dispatcher needs to confirm the state change
 *  - cadIncidentId missing → clear explanation, not a cryptic error
 *
 * Props: pass the incident and let CadWritebackButton own the hook.
 * The slide-over is pure presentation.
 *
 * Endpoints:
 *   POST /api/cad/writeback/{incidentId} — 202 { ok, status, approvalId }
 *
 * Feature gate: NEXT_PUBLIC_ENABLE_CAD_WRITEBACK=1
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cadPushGateMessage,
  isCadPushBlockedByPictureStatus,
  type PictureStatus,
} from "rapid-cortex-shared";
import {
  useCadWriteback,
  type WritebackFormValues,
} from "@/hooks/use-cad-writeback";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

// ─── Design tokens ────────────────────────────────────────────────────────────

const V = {
  bg:          "#09080f",
  surface:     "#0f0d1a",
  surfaceAlt:  "#141220",
  border:      "#1e1a30",
  textPrimary: "#e4dff5",
  textSec:     "#9b91bb",
  textMuted:   "#5a4d7a",
  violet:      "#7c3aed",
  amber:       "#f59e0b",
  amberBg:     "#1c1000",
  amberBorder: "#92400e",
  amberText:   "#fcd34d",
  green:       "#10b981",
  greenBg:     "#052e16",
  greenBorder: "#166534",
  red:         "#ef4444",
  redBg:       "#1f0808",
  redBorder:   "#991b1b",
};

const CAD_NATURE_CODES = [
  { code: "ASSLT",       label: "Assault" },
  { code: "SHOTS",       label: "Shots Fired" },
  { code: "FIRE_STRUCT", label: "Structure Fire" },
  { code: "CARD",        label: "Cardiac Emergency" },
  { code: "MVC",         label: "Vehicle Crash" },
  { code: "MED_GEN",     label: "Medical Emergency" },
  { code: "OD",          label: "Drug Overdose" },
  { code: "DOM",         label: "Domestic Disturbance" },
  { code: "BURG",        label: "Burglary" },
  { code: "WELF",        label: "Welfare Check" },
  { code: "DIST",        label: "Disturbance" },
  { code: "OTHER",       label: "Other / Manual" },
];

const PRIORITY_OPTIONS = [
  { value: "P1", label: "P1 — Immediate" },
  { value: "P2", label: "P2 — Urgent" },
  { value: "P3", label: "P3 — Standard" },
  { value: "P4", label: "P4 — Non-urgent" },
];

const inputCss: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  background: V.surfaceAlt,
  border: `1px solid ${V.border}`,
  borderRadius: 6,
  color: V.textPrimary,
  fontSize: 13,
  outline: "none",
  transition: "border-color 0.15s",
  fontFamily: "inherit",
};

const labelCss: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: V.textMuted,
  marginBottom: 5,
};

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    function update() {
      const ms = Date.now() - new Date(since).getTime();
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [since]);

  return <span>{elapsed}</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CadWritebackSlideOverProps {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  incident?: {
    cadIncidentId?: string | null;
    incidentType?: string;
    priority?: string;
    location?: string;
    callerName?: string;
  };
  userRole?: string;
  /** Field-confidence picture status — blocks submit when INCOMPLETE/CONFLICTED. */
  pictureStatus?: PictureStatus | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CadWritebackSlideOver({
  open,
  onClose,
  incidentId,
  incident,
  userRole,
  pictureStatus = null,
}: CadWritebackSlideOverProps) {
  const { state, submit, retry, openPreflight } = useCadWriteback({
    incidentId,
    incident,
    onSubmitted: () => {},
  });

  const pictureBlocked = isCadPushBlockedByPictureStatus(pictureStatus);
  const pictureBlockMessage =
    pictureBlocked && pictureStatus ? cadPushGateMessage(pictureStatus) : null;

  useEffect(() => {
    if (open) void openPreflight();
  }, [open, openPreflight]);

  // Form state
  const [narrative, setNarrative]         = useState("");
  const [cadNatureCode, setCadNatureCode] = useState(incident?.incidentType ?? "");
  const [priority, setPriority]           = useState(incident?.priority ?? "");
  const [units, setUnits]                 = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attested, setAttested]           = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  const narrativeRef = useRef<HTMLTextAreaElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setNarrative("");
      setCadNatureCode(incident?.incidentType ?? "");
      setPriority(incident?.priority ?? "");
      setUnits("");
      setInternalNotes("");
      setAttested(false);
      setNarrativeError(null);
      requestAnimationFrame(() => narrativeRef.current?.focus());
    }
  }, [open, incident]);

  useKeyboardShortcut({ key: "Escape", enabled: open }, onClose);

  const handleSubmit = useCallback(async () => {
    if (pictureBlocked) return;
    if (narrative.trim().length < 10) {
      setNarrativeError("Narrative must be at least 10 characters");
      return;
    }
    if (!attested) return;

    const values: WritebackFormValues = {
      narrative: narrative.trim(),
      cadNatureCode: cadNatureCode || undefined,
      priority: priority || undefined,
      units: units.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
    };
    await submit(values);
  }, [narrative, attested, cadNatureCode, priority, units, internalNotes, submit, pictureBlocked]);

  const phase = state.phase;
  const isPending = phase === "pending";
  const isSubmitting = phase === "submitting";
  const isReady = phase === "ready" || phase === "idle" || phase === "preflight";
  const borderColor = isPending ? V.greenBorder
    : phase === "no_cad_link" ? V.redBorder
    : V.amberBorder;

  return (
    <>
      {open && (
        <div
          role="presentation"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, backdropFilter: "blur(1px)" }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send update to CAD"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 500, maxWidth: "100vw", zIndex: 301,
          background: V.surface,
          borderLeft: `3px solid ${borderColor}`,
          display: "flex", flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "-8px 0 40px rgba(0,0,0,0.7)" : "none",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: `1px solid ${V.border}`,
          background: V.bg, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: isPending ? V.green : V.amber,
              boxShadow: `0 0 6px ${isPending ? V.green : V.amber}`,
            }} />
            <span style={{ color: V.textPrimary, fontSize: 14, fontWeight: 700 }}>
              Send to CAD
            </span>
            {isPending && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: V.green,
                background: V.greenBg, border: `1px solid ${V.greenBorder}`,
                borderRadius: 4, padding: "2px 7px", letterSpacing: "0.06em",
              }}>
                PENDING APPROVAL
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: V.textMuted, cursor: "pointer", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        {/* Incident context strip */}
        {incident && (
          <div style={{
            padding: "10px 18px",
            background: V.amberBg,
            borderBottom: `1px solid ${V.amberBorder}`,
            display: "flex", gap: 14, flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 10, color: V.textMuted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Incident</div>
              <div style={{ fontSize: 12, color: V.textPrimary, marginTop: 2 }}>{incident.incidentType ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: V.textMuted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Location</div>
              <div style={{ fontSize: 12, color: V.textPrimary, marginTop: 2, maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {incident.location ?? "—"}
              </div>
            </div>
            {incident.cadIncidentId && (
              <div style={{ marginLeft: "auto" }}>
                <div style={{ fontSize: 10, color: V.textMuted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>CAD ID</div>
                <div style={{ fontSize: 11, color: V.amberText, fontFamily: "monospace", marginTop: 2 }}>
                  {incident.cadIncidentId}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

          {/* no_cad_link state */}
          {phase === "no_cad_link" && (
            <div style={{
              padding: "14px 16px",
              background: V.redBg, border: `1px solid ${V.redBorder}`, borderRadius: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: V.red, marginBottom: 6 }}>
                No CAD incident linked
              </div>
              <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
                {state.reason}
              </div>
            </div>
          )}

          {/* error state */}
          {phase === "error" && (
            <div style={{
              padding: "12px 14px",
              background: V.redBg, border: `1px solid ${V.redBorder}`, borderRadius: 8,
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: V.red, marginBottom: 4 }}>
                Write-back failed
              </div>
              <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>
                {state.message}
              </div>
              <button
                type="button"
                onClick={retry}
                style={{
                  padding: "7px 14px", background: V.surfaceAlt,
                  border: `1px solid ${V.border}`, borderRadius: 5,
                  color: V.textSec, fontSize: 12, cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* pending state */}
          {isPending && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{
                padding: "16px 18px",
                background: V.greenBg, border: `1px solid ${V.greenBorder}`, borderRadius: 8,
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{ fontSize: 24 }}>✓</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#86efac", marginBottom: 4 }}>
                    Submitted for supervisor approval
                  </div>
                  <div style={{ fontSize: 12, color: "#4ade80", lineHeight: 1.6 }}>
                    A supervisor or Agency IT must approve before this update reaches CAD.
                    You can close this panel — the request is saved.
                  </div>
                </div>
              </div>

              <div style={{
                background: V.surfaceAlt, border: `1px solid ${V.border}`, borderRadius: 7,
                padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: V.textMuted }}>Approval ID</span>
                  <span style={{ fontSize: 11, color: V.textPrimary, fontFamily: "monospace" }}>
                    {state.approvalId}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: V.textMuted }}>Waiting</span>
                  <span style={{ fontSize: 11, color: V.amber }}>
                    <ElapsedTimer since={state.submittedAt} />
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: V.textMuted }}>Status</span>
                  <span style={{ fontSize: 11, color: "#86efac", fontWeight: 700 }}>
                    Awaiting supervisor
                  </span>
                </div>
              </div>

              <div style={{
                padding: "10px 12px",
                background: V.amberBg, border: `1px solid ${V.amberBorder}`, borderRadius: 6,
                fontSize: 11, color: V.amberText, lineHeight: 1.5,
              }}>
                ⚠ Do not submit a duplicate write-back. This request is pending.
                If circumstances change, contact your supervisor to reject this request.
              </div>
            </div>
          )}

          {/* ready / submitting / error+retry — show the form */}
          {(isReady || phase === "submitting" || phase === "error") && !isPending && (
            <div>
              {/* Narrative — primary field */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelCss}>
                  Narrative *
                  <span style={{ color: V.textMuted, fontWeight: 400, fontSize: 9, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                    This text will be sent to CAD
                  </span>
                </label>
                <textarea
                  ref={narrativeRef}
                  rows={6}
                  value={narrative}
                  onChange={(e) => { setNarrative(e.target.value); setNarrativeError(null); }}
                  placeholder="Describe the update to send to CAD — caller report, unit status, scene conditions, injury information…"
                  style={{
                    ...inputCss,
                    resize: "vertical",
                    minHeight: 120,
                    lineHeight: 1.55,
                    borderColor: narrativeError ? V.red : V.border,
                  }}
                />
                {narrativeError && (
                  <div style={{ fontSize: 11, color: V.red, marginTop: 3 }}>{narrativeError}</div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 10, color: V.textMuted, marginTop: 3 }}>
                  {narrative.trim().length} chars
                </div>
              </div>

              {/* Secondary fields — collapsible row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelCss}>CAD nature code</label>
                  <select
                    value={cadNatureCode}
                    onChange={(e) => setCadNatureCode(e.target.value)}
                    style={{ ...inputCss, cursor: "pointer" }}
                  >
                    <option value="">— unchanged —</option>
                    {CAD_NATURE_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelCss}>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{ ...inputCss, cursor: "pointer" }}
                  >
                    <option value="">— unchanged —</option>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelCss}>Units (comma-separated)</label>
                <input
                  type="text"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="E.g. P1, M3, E6"
                  style={inputCss}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={labelCss}>
                  Internal notes
                  <span style={{ color: V.textMuted, fontWeight: 400, fontSize: 9, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                    Audit record only — not sent to CAD
                  </span>
                </label>
                <input
                  type="text"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Why this update is being sent…"
                  style={inputCss}
                />
              </div>

              {/* Picture-status gate */}
              {pictureBlockMessage ? (
                <div
                  role="alert"
                  style={{
                    marginBottom: 14,
                    padding: "10px 12px",
                    background: V.redBg,
                    border: `1px solid ${V.redBorder}`,
                    borderRadius: 7,
                    color: "#fca5a5",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {pictureBlockMessage}
                  {pictureStatus ? (
                    <div style={{ marginTop: 4, fontSize: 10, color: V.textMuted }}>
                      Picture status: {pictureStatus}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Attestation */}
              <label style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "12px 14px",
                background: attested ? "#0a1a10" : V.amberBg,
                border: `1px solid ${attested ? V.greenBorder : V.amberBorder}`,
                borderRadius: 7, cursor: pictureBlocked ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                opacity: pictureBlocked ? 0.55 : 1,
              }}>
                <input
                  type="checkbox"
                  checked={attested}
                  disabled={pictureBlocked}
                  onChange={(e) => setAttested(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0, accentColor: V.green }}
                />
                <span style={{
                  fontSize: 12,
                  color: attested ? "#86efac" : V.amberText,
                  lineHeight: 1.6,
                }}>
                  I confirm this narrative is accurate and appropriate to send to the CAD system.
                  I understand this action is logged and requires supervisor approval.
                </span>
              </label>
            </div>
          )}

          <div style={{ height: 80 }} />
        </div>

        {/* Footer */}
        {!isPending && phase !== "no_cad_link" && (
          <div style={{
            borderTop: `1px solid ${V.border}`,
            background: V.bg, padding: "12px 18px",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 16px", background: "transparent",
                border: `1px solid ${V.border}`, borderRadius: 6,
                color: V.textSec, fontSize: 13, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              disabled={pictureBlocked || !attested || isSubmitting || narrative.trim().length < 10}
              onClick={() => void handleSubmit()}
              style={{
                padding: "9px 22px",
                background:
                  !pictureBlocked && attested && narrative.trim().length >= 10 && !isSubmitting
                    ? V.amber
                    : V.surfaceAlt,
                border: `1px solid ${!pictureBlocked && attested ? V.amberBorder : V.border}`,
                borderRadius: 6,
                color: !pictureBlocked && attested && !isSubmitting ? "#0d0a00" : V.textMuted,
                fontSize: 13, fontWeight: 800,
                cursor: !pictureBlocked && attested && !isSubmitting ? "pointer" : "not-allowed",
                minWidth: 150,
              }}
            >
              {pictureBlocked ? "Picture incomplete" : isSubmitting ? "Submitting…" : "Send to CAD"}
            </button>
          </div>
        )}

        {isPending && (
          <div style={{
            borderTop: `1px solid ${V.border}`,
            background: V.bg, padding: "12px 18px",
            display: "flex", justifyContent: "flex-end", flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 22px",
                background: V.violet, border: "none",
                borderRadius: 6, color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Trigger button ────────────────────────────────────────────────────────────

/**
 * CadWritebackButton
 *
 * Drop-in trigger for the incident detail panel.
 * Renders nothing when NEXT_PUBLIC_ENABLE_CAD_WRITEBACK is off.
 */
export function CadWritebackButton({
  incidentId,
  incident,
  userRole,
  pictureStatus = null,
}: {
  incidentId: string;
  incident?: CadWritebackSlideOverProps["incident"];
  userRole?: string;
  pictureStatus?: PictureStatus | null;
}) {
  const [open, setOpen] = useState(false);
  const enabled = isCadWritebackUiEnabled();

  if (!enabled) return null;

  const hasCadLink = !!incident?.cadIncidentId;
  const pictureBlocked = isCadPushBlockedByPictureStatus(pictureStatus);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          pictureBlocked && pictureStatus
            ? cadPushGateMessage(pictureStatus)
            : hasCadLink
              ? "Send update to CAD"
              : "No CAD incident linked"
        }
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "8px 14px",
          background: pictureBlocked ? V.redBg : hasCadLink ? V.amberBg : V.surfaceAlt,
          border: `1px solid ${pictureBlocked ? V.redBorder : hasCadLink ? V.amberBorder : V.border}`,
          borderRadius: 6,
          color: pictureBlocked ? "#fca5a5" : hasCadLink ? V.amberText : V.textMuted,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 14 }}>↑</span>
        Send to CAD
        {pictureBlocked ? (
          <span style={{ fontSize: 10, color: "#fca5a5" }}>({pictureStatus})</span>
        ) : !hasCadLink ? (
          <span style={{ fontSize: 10, color: V.textMuted }}>(no link)</span>
        ) : null}
      </button>

      <CadWritebackSlideOver
        open={open}
        onClose={() => setOpen(false)}
        incidentId={incidentId}
        incident={incident}
        userRole={userRole}
        pictureStatus={pictureStatus}
      />
    </>
  );
}
