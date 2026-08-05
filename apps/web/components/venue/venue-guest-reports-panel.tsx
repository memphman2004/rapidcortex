"use client";

import { useEffect, useState } from "react";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { formatVenueTimeAgo } from "@/components/venue/use-venue-ops-data";


function guestReportStatus(inc: VenueIncident): string {
  if (inc.status === "resolved") return "Resolved";
  if (inc.status === "assigned" || inc.status === "responding") return "Acknowledged";
  return "New";
}

/** Guest-services inbox — QR/SMS submissions only; no incident queue or ops links. */
export function VenueGuestReportsPanel({ agencyId }: { agencyId: string }) {
  const venueCode = extractVenueCode(agencyId);
  const [rows, setRows] = useState<VenueIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const all = await fetchVenueIncidents(venueCode, {
          status: ["open", "assigned", "responding", "resolved"],
        });
        setRows(
          all.filter((row) => row.source === "qr" || row.source === "sms").slice(0, 50),
        );
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [venueCode]);

  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--rc-text-primary)", margin: "0 0 4px" }}>
        Guest Reports
      </h2>
      <p style={{ fontSize: 12, color: "var(--rc-text-secondary)", margin: "0 0 16px" }}>
        Incoming fan-submitted QR and SMS reports. Route to security or mark resolved from this
        inbox — not a 911 dispatch console.
      </p>

      {loading ? (
        <p style={{ color: "var(--rc-text-muted)", fontSize: 12 }}>Loading guest reports…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--rc-text-muted)", fontSize: 12 }}>No guest reports yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                background: "var(--rc-surface)",
                border: `1px solid var(--rc-border)`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "80px 1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--rc-amber)",
                  background: "var(--rc-amber-dim)",
                  border: `1px solid var(--rc-amber)44`,
                  borderRadius: 4,
                  padding: "3px 6px",
                  textAlign: "center",
                }}
              >
                {row.source.toUpperCase()}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--rc-text-primary)" }}>
                  {row.qrLocationName ?? row.zoneLabel}
                </div>
                <div style={{ fontSize: 10, color: "var(--rc-text-secondary)" }}>
                  {row.description.slice(0, 120)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--rc-amber)" }}>
                  {guestReportStatus(row)}
                </span>
                <div style={{ fontSize: 10, color: "var(--rc-text-muted)" }}>
                  {formatVenueTimeAgo(row.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
