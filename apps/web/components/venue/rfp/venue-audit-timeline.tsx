"use client";

import { useEffect, useState } from "react";
import {
  fetchVenueRfpAuditForIncident,
  type VenueRfpAuditItem,
} from "@/lib/venue/venue-rfp-api";
import { VenueRfpPanelShell } from "./venue-rfp-panel-shell";

export function VenueAuditTimeline({
  venueCode,
  incidentId,
}: {
  venueCode: string;
  incidentId: string;
}) {
  const [items, setItems] = useState<VenueRfpAuditItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchVenueRfpAuditForIncident(venueCode, incidentId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit"));
  }, [incidentId, venueCode]);

  return (
    <VenueRfpPanelShell title="Audit trail">
      {error ? <p style={{ fontSize: 11, color: "var(--rc-amber)" }}>{error}</p> : null}
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((evt) => (
          <li
            key={`${evt.timestamp}-${evt.resourceId}-${evt.eventType}`}
            style={{
              borderLeft: "2px solid var(--rc-amber)",
              paddingLeft: 10,
              fontSize: 11,
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--rc-text-primary)" }}>{evt.eventType}</div>
            <div style={{ color: "var(--rc-text-muted)", marginTop: 2 }}>
              {evt.timestamp} · {evt.actorRole} · {evt.resourceType}/{evt.resourceId}
            </div>
          </li>
        ))}
        {items.length === 0 && !error ? (
          <li style={{ fontSize: 12, color: "var(--rc-text-muted)" }}>No audit events yet.</li>
        ) : null}
      </ul>
    </VenueRfpPanelShell>
  );
}
