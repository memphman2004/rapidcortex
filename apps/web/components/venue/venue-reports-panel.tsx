"use client";

import Link from "next/link";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import { useEffect, useState } from "react";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import {
  formatVenueTimeAgo,
  mapVenueIncidentStatus,
  mapVenueIncidentType,
} from "@/components/venue/use-venue-ops-data";

export function VenueReportsPanel({ agencyId, linkBase }: { agencyId: string; linkBase: string }) {
  const venueCode = extractVenueCode(agencyId);
  const [rows, setRows] = useState<VenueIncident[]>([]);

  useEffect(() => {
    void fetchVenueIncidents(venueCode).then(setRows).catch(() => setRows([]));
  }, [venueCode]);

  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Incident Reports</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
          <Link key={row.id} href={`${linkBase}/incidents/${row.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "#141220", border: "1px solid #1e1a30", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 11 }}>{mapVenueIncidentType(row.type)}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{row.zoneLabel}</div>
              <div style={{ fontSize: 10, color: "#5a4d7a", marginTop: 4 }}>
                {mapVenueIncidentStatus(row.status)} · {formatVenueTimeAgo(row.updatedAt)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
