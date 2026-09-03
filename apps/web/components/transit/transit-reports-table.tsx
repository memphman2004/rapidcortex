"use client";

import type { CSSProperties } from "react";
import type { TransitReport } from "rapid-cortex-shared";
import { T } from "./transit-theme";

/** Passenger / QR / ops reports for the transit agency. */
export function TransitReportsTable({ reports }: { reports: TransitReport[] }) {
  if (reports.length === 0) {
    return <div style={{ color: T.textSecondary, fontSize: 13 }}>No passenger reports yet.</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {reports.map((report) => (
        <li key={report.reportId} style={rowStyle}>
          <strong>{report.source.toUpperCase()}</strong> — {report.summary}
          {report.vehicleId ? ` · ${report.vehicleId}` : ""}
          {report.stationId ? ` · ${report.stationId}` : ""}
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>{report.createdAt}</div>
        </li>
      ))}
    </ul>
  );
}

const rowStyle: CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
  color: T.textPrimary,
};
