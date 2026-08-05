"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, X } from "lucide-react";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { rcsGetFloorHealth, type RcsFloorHealthSnapshot } from "@/lib/rcs/rcs-api";
import { audioStatusColor, escalationColor, formatElapsed } from "./rcs-ui-utils";

export type RcsFloorHealthPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function RcsFloorHealthPanel({ open, onClose }: RcsFloorHealthPanelProps) {
  const [snapshot, setSnapshot] = useState<RcsFloorHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void rcsGetFloorHealth()
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load floor health");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(2, 6, 23, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
          borderRadius: 12,
          border: `1px solid ${RCS_SURFACE.border}`,
          background: RCS_SURFACE.cardBg,
          padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Activity size={16} color="#7dd3fc" />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: RCS_SURFACE.heading }}>
            Floor Health
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: "auto", background: "none", border: "none", color: RCS_SURFACE.subtleText, cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText }}>Loading snapshot…</p>
        ) : error ? (
          <div style={{ display: "flex", gap: 8, color: "#fca5a5", fontSize: 12 }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        ) : snapshot ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14, fontSize: 12 }}>
              <Stat label="Open" value={snapshot.totalOpenCalls} />
              <Stat label="Critical" value={snapshot.criticalCallCount} accent="#f87171" />
              <Stat label="Pending handoff" value={snapshot.pendingHandoffCount} accent="#fde047" />
              <Stat label="Overdue arrival" value={snapshot.overdueArrivalCount} accent="#fdba74" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {snapshot.activeCalls.length === 0 ? (
                <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText }}>No open calls.</p>
              ) : (
                snapshot.activeCalls.map((c) => (
                  <div
                    key={c.callId}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${RCS_SURFACE.border}`,
                      padding: "10px 12px",
                      fontSize: 11,
                      color: RCS_SURFACE.bodyText,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <strong style={{ color: RCS_SURFACE.heading }}>{c.callId}</strong>
                      <span style={{ color: escalationColor(c.escalationLevel) }}>{c.escalationLevel}</span>
                      <span style={{ color: audioStatusColor(c.audioStatus) }}>{c.audioStatus}</span>
                      <span style={{ marginLeft: "auto", color: RCS_SURFACE.subtleText }}>
                        {formatElapsed(c.totalElapsedSeconds)}
                      </span>
                    </div>
                    {c.aiSummaryText ? (
                      <p style={{ margin: "6px 0 0", color: RCS_SURFACE.subtleText }}>{c.aiSummaryText}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${RCS_SURFACE.border}`,
        padding: "8px 12px",
        minWidth: 100,
      }}
    >
      <div style={{ fontSize: 10, color: RCS_SURFACE.subtleText, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? RCS_SURFACE.heading }}>{value}</div>
    </div>
  );
}
