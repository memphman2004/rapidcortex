"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import {
  formatVenueTimeAgo,
  mapVenueIncidentStatus,
  mapVenueIncidentType,
} from "@/components/venue/use-venue-ops-data";

const V = {
  surface: "#100e1a",
  surfaceAlt: "#141220",
  border: "#1e1a30",
  amber: "#f59e0b",
  textPrimary: "#e4dff5",
  textSecondary: "#5a4d7a",
  textMuted: "#2d2445",
};

export function VenueGuestReportsPanel({
  agencyId,
  linkBase,
}: {
  agencyId: string;
  linkBase: string;
}) {
  const venueCode = extractVenueCode(agencyId);
  const [rows, setRows] = useState<VenueIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const all = await fetchVenueIncidents(venueCode, { status: ["open", "assigned", "responding", "resolved"] });
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

  function guestStatus(inc: VenueIncident): string {
    if (inc.status === "resolved") return "Resolved";
    if (inc.status === "assigned" || inc.status === "responding") return "Acknowledged";
    return "New";
  }

  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: V.textPrimary, margin: "0 0 4px" }}>
        Guest Reports
      </h2>
      <p style={{ fontSize: 12, color: V.textSecondary, margin: "0 0 16px" }}>
        Fan-submitted QR and SMS reports — separate from internal security incidents.
      </p>

      {loading ? (
        <p style={{ color: V.textMuted, fontSize: 12 }}>Loading guest reports…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: V.textMuted, fontSize: 12 }}>No guest reports yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`${linkBase}/incidents/${encodeURIComponent(row.id)}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  background: V.surface,
                  border: `1px solid ${V.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "grid",
                  gridTemplateColumns: "80px 1fr auto auto",
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
                    {row.qrRcli ? `RCLI ${row.qrRcli}` : row.description.slice(0, 60)}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: V.amber }}>
                  {mapVenueIncidentType(row.type)}
                </span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, color: V.textSecondary }}>{guestStatus(row)}</span>
                  <div style={{ fontSize: 10, color: V.textMuted }}>
                    {formatVenueTimeAgo(row.createdAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
