"use client";

/**
 * Campus Blue-Light Connect — Ops Panel
 *
 * Shows live blue-light activations for this campus. Mounts only inside the
 * campus console (campus vertical only — never rendered for PSAP, venue, etc.).
 *
 * WebSocket events arrive via useAgencyWebSocket (existing campus hook).
 * The panel receives the filtered events via the `events` prop from the parent,
 * avoiding a second socket connection.
 *
 * Failsafe note: NexCort iQ is a parallel observer. This panel shows what the
 * pole system reported; it never interacts with SIP/PSTN voice paths.
 */

import { useEffect, useState } from "react";
import type { BlueLightIncident, BlueLightPole } from "rapid-cortex-shared";
import { BLUE_LIGHT_WS_EVENT_ACTIVATION, BLUE_LIGHT_WS_EVENT_INCIDENT_UPDATE } from "rapid-cortex-shared";
import { C } from "@/lib/theme/rc-theme-tokens";
import type { AgencyWebSocketMessage } from "@/hooks/use-agency-websocket";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlueLightActivationEvent = {
  incident: BlueLightIncident;
};

/** BLUE_LIGHT_INCIDENT_UPDATE with status=resolved is how we clear an activation. */
export type BlueLightIncidentUpdateEvent = {
  incidentId: string;
  updates: Partial<BlueLightIncident>;
};

type BlueLightEntry = {
  incident: BlueLightIncident;
  receivedAt: number;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export type BlueLightPanelProps = {
  agencyId: string;
  /** Latest raw WS message — parent passes all messages; this component filters. */
  lastWsMessage: AgencyWebSocketMessage | null;
  /** Poles fetched from GET /api/campus/bluelight/poles */
  poles: BlueLightPole[];
  polesLoading?: boolean;
  /** If true, shows a "demo" badge. Never allows real simulation. */
  demoMode?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function statusColor(status: BlueLightIncident["status"]): string {
  switch (status) {
    case "active":
      return "#ef4444";
    case "monitoring":
      return "#f97316";
    default:
      return C.amber;
  }
}

// ─── Pole Card ─────────────────────────────────────────────────────────────────

function PoleCard({
  pole,
  active,
  entry,
  onAcknowledge,
}: {
  pole: BlueLightPole;
  active: boolean;
  entry?: BlueLightEntry;
  onAcknowledge?: (incidentId: string) => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [active]);
  void tick; // force re-render for "ago" timer

  const dotColor = active ? "#ef4444" : C.green;
  const borderColor = active ? "#ef4444" : C.border;
  const bg = active
    ? "linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(9,13,26,0.92) 100%)"
    : C.card;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 6,
        transition: "border-color 0.2s, background 0.3s",
        position: "relative",
      }}
    >
      {/* Pulsing dot when active */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: active ? `0 0 0 3px rgba(239,68,68,0.3)` : "none",
          animation: active ? "bluelight-pulse 1.5s ease-in-out infinite" : "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        {/* Blue-light icon */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            background: active ? "rgba(239,68,68,0.18)" : "rgba(14,165,233,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            flexShrink: 0,
          }}
        >
          {active ? "🚨" : "🔵"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: C.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pole.label}
          </div>
          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>
            {[pole.zone, pole.buildingId].filter(Boolean).join(" · ") || "No location info"}
          </div>

          {active && entry ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `rgba(239,68,68,0.2)`,
                    color: "#fca5a5",
                    border: "1px solid rgba(239,68,68,0.3)",
                    letterSpacing: "0.4px",
                  }}
                >
                  ACTIVE
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `rgba(${entry.incident.status === "active" ? "239,68,68" : "245,158,11"},0.12)`,
                    color: statusColor(entry.incident.status),
                    border: `1px solid ${statusColor(entry.incident.status)}44`,
                    letterSpacing: "0.4px",
                  }}
                >
                  {entry.incident.status.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: C.textMuted }}>
                  {formatAgo(entry.receivedAt)}
                </span>
              </div>
              {entry.incident.callStatus !== "none" && (
                <div style={{ fontSize: 10.5, color: C.textSub, marginTop: 4 }}>
                  Call: {entry.incident.callStatus.replace(/_/g, " ")}
                </div>
              )}
              {onAcknowledge && (
                <button
                  type="button"
                  onClick={() => onAcknowledge(entry.incident.incidentId)}
                  style={{
                    marginTop: 8,
                    padding: "5px 12px",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    borderRadius: 5,
                    cursor: "pointer",
                    color: "#fca5a5",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                >
                  Acknowledge
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: C.green, marginTop: 4, fontWeight: 500 }}>
              Standby
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function BlueLightPanel({
  agencyId: _agencyId,
  lastWsMessage,
  poles,
  polesLoading,
  demoMode,
}: BlueLightPanelProps) {
  const [activeEntries, setActiveEntries] = useState<Map<string, BlueLightEntry>>(new Map());

  // Process incoming WS messages
  useEffect(() => {
    if (!lastWsMessage) return;

    if (lastWsMessage.type === BLUE_LIGHT_WS_EVENT_ACTIVATION) {
      const data = lastWsMessage.data as BlueLightActivationEvent;
      if (!data?.incident?.incidentId) return;
      setActiveEntries((prev) => {
        const next = new Map(prev);
        next.set(data.incident.poleId, { incident: data.incident, receivedAt: Date.now() });
        return next;
      });
    }

    if (lastWsMessage.type === BLUE_LIGHT_WS_EVENT_INCIDENT_UPDATE) {
      const data = lastWsMessage.data as BlueLightIncidentUpdateEvent;
      if (!data?.incidentId) return;
      // If the update resolves/false_alarms the incident, clear from active map
      if (data.updates?.status === "resolved" || data.updates?.status === "false_alarm") {
        setActiveEntries((prev) => {
          const next = new Map(prev);
          for (const [poleId, entry] of next.entries()) {
            if (entry.incident.incidentId === data.incidentId) {
              next.delete(poleId);
              break;
            }
          }
          return next;
        });
      }
    }
  }, [lastWsMessage]);

  const acknowledge = (incidentId: string) => {
    setActiveEntries((prev) => {
      const next = new Map(prev);
      for (const [poleId, entry] of next.entries()) {
        if (entry.incident.incidentId === incidentId) {
          next.delete(poleId);
          break;
        }
      }
      return next;
    });
  };

  const activeCount = activeEntries.size;

  return (
    <>
      {/* Keyframe for pulse animation */}
      <style>{`
        @keyframes bluelight-pulse {
          0%, 100% { box-shadow: 0 0 0 0px rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(239,68,68,0.0); }
        }
      `}</style>

      <div
        style={{
          background: C.card,
          border: `1px solid ${activeCount > 0 ? "rgba(239,68,68,0.5)" : C.border}`,
          borderRadius: 10,
          overflow: "hidden",
          transition: "border-color 0.3s",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 14px 9px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 16 }}>🔵</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textSub,
                letterSpacing: "0.7px",
              }}
            >
              BLUE-LIGHT CONNECT
            </span>
            {demoMode && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(245,158,11,0.12)",
                  color: C.amber,
                  border: `1px solid rgba(245,158,11,0.25)`,
                  letterSpacing: "0.4px",
                }}
              >
                DEMO
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {activeCount > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                }}
              >
                {activeCount} ACTIVE
              </span>
            )}
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: activeCount > 0 ? "#ef4444" : C.green,
                transition: "background 0.3s",
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "8px 10px 10px", maxHeight: 380, overflowY: "auto" }}>
          {polesLoading && poles.length === 0 ? (
            <div style={{ padding: "12px 4px", fontSize: 12, color: C.textMuted }}>
              Loading poles…
            </div>
          ) : poles.length === 0 ? (
            <div style={{ padding: "12px 4px", fontSize: 12, color: C.textMuted }}>
              No blue-light poles registered for this campus.
            </div>
          ) : (
            poles.map((pole) => {
              const entry = activeEntries.get(pole.poleId);
              return (
                <PoleCard
                  key={pole.poleId}
                  pole={pole}
                  active={Boolean(entry)}
                  entry={entry}
                  onAcknowledge={acknowledge}
                />
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: "7px 14px",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.green,
            }}
          />
          <span style={{ fontSize: 10, color: C.textMuted }}>
            NexCort iQ — parallel observer. Not in voice path.
          </span>
        </div>
      </div>
    </>
  );
}
