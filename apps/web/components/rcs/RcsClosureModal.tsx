"use client";

/**
 * Closure gate modal — normal close when UNIT_ARRIVED; supervisor override otherwise.
 */

import { useState } from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared";
import { canSupervisorOverride } from "@/lib/rcs/rcs-authz";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { rcsCloseCall, type RcsCall } from "@/lib/rcs/rcs-api";

export type RcsClosureModalProps = {
  call: RcsCall;
  user: UserContext;
  onClose: () => void;
  onClosed: (call: RcsCall) => void;
};

export function RcsClosureModal({ call, user, onClose, onClosed }: RcsClosureModalProps) {
  const needsOverride = call.state !== "UNIT_ARRIVED";
  const canOverride = canSupervisorOverride(user, call.agencyId);
  const [badge, setBadge] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overrideValid = badge.trim().length > 0 && reason.trim().length >= 20;
  const canSubmit = needsOverride ? canOverride && overrideValid : true;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await rcsCloseCall(
        call.callId,
        needsOverride
          ? { supervisorOverride: { badge: badge.trim(), reason: reason.trim() } }
          : {},
      );
      onClosed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close call");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6, 8, 14, 0.72)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 12,
          border: `1px solid ${RCS_SURFACE.border}`,
          background: "#0f172a",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={16} color="#fdba74" />
            <span style={{ fontSize: 14, fontWeight: 600, color: RCS_SURFACE.heading }}>
              {needsOverride ? "Supervisor override close" : "Close RCS call"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            style={{ background: "transparent", border: "none", color: RCS_SURFACE.subtleText, cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {needsOverride ? (
          <>
            <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText, margin: 0 }}>
              Unit arrival is not confirmed (state: {call.state}). To close now, enter your badge
              number and a reason of at least 20 characters. This is permanently audit-logged.
            </p>
            {!canOverride ? (
              <p style={{ fontSize: 12, color: "#fca5a5", margin: 0 }}>
                Supervisor authorization required.
              </p>
            ) : (
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: RCS_SURFACE.subtleText }}>
                  Supervisor badge #
                  <input
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    maxLength={64}
                    placeholder="e.g. 4821"
                    autoFocus
                    style={{
                      borderRadius: 6,
                      border: `1px solid ${badge.trim() ? RCS_SURFACE.border : "rgba(251, 146, 60, 0.45)"}`,
                      background: RCS_SURFACE.cardBg,
                      color: RCS_SURFACE.heading,
                      padding: "8px 10px",
                      fontSize: 12,
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: RCS_SURFACE.subtleText }}>
                  Override reason
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Describe why this call is being closed before unit arrival…"
                    style={{
                      borderRadius: 6,
                      border: `1px solid ${
                        reason.trim().length >= 20 ? RCS_SURFACE.border : "rgba(251, 146, 60, 0.45)"
                      }`,
                      background: RCS_SURFACE.cardBg,
                      color: RCS_SURFACE.heading,
                      padding: "8px 10px",
                      fontSize: 12,
                      resize: "vertical",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: reason.trim().length >= 20 ? "#86efac" : "#fdba74",
                    }}
                  >
                    {reason.trim().length} / 20 characters minimum
                    {reason.trim().length < 20
                      ? ` — ${20 - reason.trim().length} more needed`
                      : " — ready"}
                  </span>
                </label>
              </>
            )}
          </>
        ) : (
          <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText, margin: 0 }}>
            Unit arrival confirmed. Close continuity monitoring for {call.callId}?
          </p>
        )}

        {error ? <p style={{ fontSize: 12, color: "#fca5a5", margin: 0 }}>{error}</p> : null}
        {needsOverride && canOverride && !overrideValid ? (
          <p style={{ fontSize: 11, color: "#fdba74", margin: 0 }}>
            {!badge.trim()
              ? "Enter your supervisor badge number to enable Confirm."
              : "Add at least 20 characters in the reason field to enable Confirm."}
          </p>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 6,
              border: `1px solid ${RCS_SURFACE.border}`,
              background: "transparent",
              color: RCS_SURFACE.bodyText,
              fontSize: 12,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void submit()}
            title={
              !canSubmit && needsOverride
                ? "Fill badge and a 20+ character reason to confirm"
                : undefined
            }
            style={{
              borderRadius: 6,
              border: "none",
              background: canSubmit ? "#7c3aed" : "#334155",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 12px",
              cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {needsOverride ? "Confirm override & log" : "Close call"}
          </button>
        </div>
      </div>
    </div>
  );
}
