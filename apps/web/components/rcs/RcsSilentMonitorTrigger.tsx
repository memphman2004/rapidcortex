"use client";

/**
 * Entry control: start RCS monitoring for an active call, then move to SILENT/MONITORING.
 */

import { useState } from "react";
import { Loader2, Shield } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared";
import { canManageRcsCall } from "@/lib/rcs/rcs-authz";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { rcsStartCall, rcsUpdateCallState } from "@/lib/rcs/rcs-api";

export type RcsSilentMonitorTriggerProps = {
  user: UserContext;
  incidentId?: string;
  callerPhone?: string;
  notes?: string;
  onMonitoringStarted?: (callId: string) => void;
  compact?: boolean;
};

type Phase = "idle" | "confirming" | "submitting" | "monitoring" | "error";

export function RcsSilentMonitorTrigger({
  user,
  incidentId,
  callerPhone,
  notes,
  onMonitoringStarted,
  compact = false,
}: RcsSilentMonitorTriggerProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManageRcsCall(user, user.agencyId)) return null;

  async function confirm() {
    setPhase("submitting");
    setError(null);
    try {
      const call = await rcsStartCall({
        incidentId,
        callerPhone,
        notes,
      });
      await rcsUpdateCallState(call.callId, { state: "MONITORING" });
      setCallId(call.callId);
      setPhase("monitoring");
      onMonitoringStarted?.(call.callId);
      window.dispatchEvent(
        new CustomEvent("rcs:monitoring:started", { detail: { callId: call.callId } }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start RCS monitoring");
      setPhase("error");
    }
  }

  if (phase === "monitoring" && callId) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 6,
          padding: compact ? "4px 8px" : "6px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: "#86efac",
          background: "rgba(34, 197, 94, 0.12)",
          border: "1px solid rgba(74, 222, 128, 0.35)",
        }}
      >
        <Shield size={12} />
        Protected · {callId}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {phase === "idle" || phase === "error" ? (
        <button
          type="button"
          onClick={() => setPhase("confirming")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: compact ? "4px 8px" : "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            cursor: "pointer",
            border: "1px solid #1e3a5f",
            background: "#1e3a5f",
            color: "#e2e8f0",
          }}
        >
          <Shield size={12} />
          Silent Monitor
        </button>
      ) : null}

      {phase === "confirming" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11, color: RCS_SURFACE.subtleText }}>
            Audio stays live. Call is protected until a unit arrives.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              style={{
                borderRadius: 6,
                border: `1px solid ${RCS_SURFACE.border}`,
                background: "transparent",
                color: RCS_SURFACE.bodyText,
                fontSize: 11,
                padding: "5px 8px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              style={{
                borderRadius: 6,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "5px 8px",
                cursor: "pointer",
              }}
            >
              Confirm — Silent Monitor
            </button>
          </div>
        </div>
      ) : null}

      {phase === "submitting" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: RCS_SURFACE.subtleText }}>
          <Loader2 size={12} className="animate-spin" />
          Protecting call…
        </span>
      ) : null}

      {phase === "error" && error ? (
        <div style={{ fontSize: 11, color: "#fca5a5" }}>
          {error}{" "}
          <button
            type="button"
            onClick={() => void confirm()}
            style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", padding: 0 }}
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
