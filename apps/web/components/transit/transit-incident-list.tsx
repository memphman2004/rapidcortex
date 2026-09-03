"use client";

import type { CSSProperties } from "react";
import type { TransitIncident } from "rapid-cortex-shared";
import { T } from "./transit-theme";

export function TransitIncidentList({
  incidents,
  canEscalate,
  onEscalate,
}: {
  incidents: TransitIncident[];
  canEscalate: boolean;
  onEscalate: (id: string) => void;
}) {
  if (incidents.length === 0) {
    return <div style={{ color: T.textSecondary, fontSize: 13 }}>No incidents.</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {incidents.map((incident) => (
        <li key={incident.incidentId} style={rowStyle}>
          <strong>{incident.type}</strong> · {incident.status}
          {incident.escalatedTo911 ? " · 911" : ""} — {incident.summary}
          {canEscalate && !incident.escalatedTo911 ? (
            <button
              type="button"
              onClick={() => onEscalate(incident.incidentId)}
              style={{ ...actionBtn, marginLeft: 8, padding: "2px 8px" }}
            >
              Escalate 911
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const actionBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: T.blueDim,
  color: T.blue,
  border: `1px solid ${T.blue}`,
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const rowStyle: CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
  color: T.textPrimary,
};
