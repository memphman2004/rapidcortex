"use client";

import { useEffect, useState } from "react";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { formatVenueTimeAgo } from "@/components/venue/use-venue-ops-data";

const V = {
  surface: "#100e1a",
  border: "#1e1a30",
  amber: "#f59e0b",
  textPrimary: "#e4dff5",
  textSecondary: "#5a4d7a",
  textMuted: "#2d2445",
};

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
      <h2 style={{ fontSize: 16, fontWeight: 700, color: V.textPrimary, margin: "0 0 4px" }}>
        Guest Reports
      </h2>
      <p style={{ fontSize: 12, color: V.textSecondary, margin: "0 0 16px" }}>
        Incoming fan-submitted QR and SMS reports. Route to security or mark resolved from this
        inbox — not a 911 dispatch console.
      </p>

      {loading ? (
        <p style={{ color: V.textMuted, fontSize: 12 }}>Loading guest reports…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: V.textMuted, fontSize: 12 }}>No guest reports yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                background: V.surface,
                border: `1px solid ${V.border}`,
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
                  color: V.amber,
                  background: "#1a1206",
                  border: `1px solid ${V.amber}44`,
                  borderRadius: 4,
                  padding: "3px 6px",
                  textAlign: "center",
                }}
              >
                {row.source.toUpperCase()}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: V.textPrimary }}>
                  {row.qrLocationName ?? row.zoneLabel}
                </div>
                <div style={{ fontSize: 10, color: V.textSecondary }}>
                  {row.description.slice(0, 120)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: V.amber }}>
                  {guestReportStatus(row)}
                </span>
                <div style={{ fontSize: 10, color: V.textMuted }}>
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
