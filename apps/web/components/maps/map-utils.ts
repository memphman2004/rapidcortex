/**
 * Rapid Cortex — Map Utilities
 *
 * Pure helper functions — no React, no Mapbox imports.
 * Safe to import anywhere including server components.
 */

import type { RCIncident } from "./map-types";
import { SEVERITY_COLOR } from "./map-constants";

// ─── GeoJSON conversion ───────────────────────────────────────────────────────

/**
 * Converts an RCIncident array to a Mapbox-compatible GeoJSON FeatureCollection.
 *
 * IMPORTANT: Only incidents with BOTH latitude and longitude are mapped.
 * Incidents with only a locationLabel (zone/section text) are excluded from
 * the GeoJSON — show locationLabel in list views instead.
 */
export function incidentsToGeoJSON(
  incidents: RCIncident[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter(
        (inc): inc is RCIncident & { latitude: number; longitude: number } =>
          typeof inc.latitude  === "number" &&
          typeof inc.longitude === "number" &&
          !isNaN(inc.latitude) &&
          !isNaN(inc.longitude)
      )
      .map((inc) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [inc.longitude, inc.latitude],
        },
        properties: {
          id:            inc.id,
          status:        inc.status,
          severity:      inc.severity ?? "high",
          type:          inc.type,
          locationLabel: inc.locationLabel,
          createdAt:     inc.createdAt,
          description:   inc.description ?? "",
          // Pre-compute color so Mapbox expressions are simpler
          color:         SEVERITY_COLOR[inc.severity ?? "high"] ?? SEVERITY_COLOR.default,
        },
      })),
  };
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────

/**
 * Returns the HTML string for a Mapbox popup shown when clicking an incident marker.
 * Inline styles are used since the popup renders outside React's tree.
 *
 * Keep content minimal — dispatchers are under cognitive load.
 */
export function buildIncidentPopupHTML(props: {
  id: string;
  severity: string;
  type: string;
  status: string;
  locationLabel: string;
  createdAt: string;
  description?: string;
}): string {
  const color       = SEVERITY_COLOR[props.severity] ?? SEVERITY_COLOR.default;
  const severityUC  = props.severity.toUpperCase();
  const statusUC    = props.status.replace("_", " ").toUpperCase();
  const typeLabel   = props.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const time        = formatRelativeTime(props.createdAt);
  const desc        = props.description
    ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px;line-height:1.4">${escapeHtml(props.description.slice(0, 80))}${props.description.length > 80 ? "…" : ""}</div>`
    : "";

  return `
    <div style="
      background:#0f0d1c;
      border:1px solid #1e1a30;
      border-top:3px solid ${color};
      border-radius:6px;
      padding:10px 12px;
      min-width:200px;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;font-weight:700;color:${color};letter-spacing:.05em">${severityUC}</span>
        <span style="font-size:10px;color:#6b7280">${time}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:#e4dff5;margin-bottom:2px">${escapeHtml(typeLabel)}</div>
      <div style="font-size:11px;color:#9ca3af">${escapeHtml(props.locationLabel)}</div>
      ${desc}
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;color:#5a4d7a">${escapeHtml(props.id)}</span>
        <span style="
          font-size:10px;font-weight:700;
          background:${statusBgColor(props.status)};
          color:${statusTextColor(props.status)};
          padding:2px 6px;border-radius:999px;
        ">${statusUC}</span>
      </div>
    </div>
  `;
}

/**
 * Returns the HTML for the caller/report location popup.
 */
export function buildCallerPopupHTML(label: string, source?: string): string {
  const sourceLabel = source
    ? source.toUpperCase().replace("_", " ")
    : "REPORTED LOCATION";

  return `
    <div style="
      background:#0f0d1c;
      border:1px solid #1e1a30;
      border-top:3px solid #0ea5e9;
      border-radius:6px;
      padding:10px 12px;
      min-width:160px;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="font-size:10px;font-weight:700;color:#0ea5e9;letter-spacing:.05em;margin-bottom:4px">${sourceLabel}</div>
      <div style="font-size:12px;color:#e4dff5">${escapeHtml(label)}</div>
    </div>
  `;
}

// ─── Time formatting ──────────────────────────────────────────────────────────

export function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (diffMs < 60_000)  return "Just now";
    if (diffMs < 3600_000) {
      const m = Math.floor(diffMs / 60_000);
      return `${m}m ago`;
    }
    const h = Math.floor(diffMs / 3600_000);
    return `${h}h ago`;
  } catch {
    return "";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusBgColor(status: string): string {
  switch (status) {
    case "active":     return "rgba(239,68,68,0.15)";
    case "responding": return "rgba(245,158,11,0.15)";
    case "resolved":   return "rgba(107,114,128,0.15)";
    case "closed":     return "rgba(107,114,128,0.12)";
    default:           return "rgba(239,68,68,0.15)";
  }
}

function statusTextColor(status: string): string {
  switch (status) {
    case "active":     return "#ef4444";
    case "responding": return "#f59e0b";
    case "resolved":   return "#9ca3af";
    case "closed":     return "#6b7280";
    default:           return "#ef4444";
  }
}

// ─── Dev mock data ────────────────────────────────────────────────────────────

/**
 * TODO: Replace with real incident API call.
 * Endpoint pattern: GET /api/incidents?agencyId={agencyId}&status=active
 * Handled by AppSam2 / stack 2 (supervisor/dispatcher routes).
 */
export const MOCK_INCIDENTS: RCIncident[] = [
  {
    id: "INC-1024",
    status: "active",
    severity: "high",
    type: "medical",
    locationLabel: "Section 120, Row 15",
    latitude: 33.748995,
    longitude: -84.387982,
    createdAt: new Date().toISOString(),
    description: "Medical emergency — fan unresponsive",
  },
  {
    id: "INC-1023",
    status: "responding",
    severity: "medium",
    type: "disturbance",
    locationLabel: "Gate C Concourse",
    latitude: 33.7502,
    longitude: -84.3885,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    description: "Verbal altercation near gate entrance",
  },
  {
    id: "INC-1022",
    status: "resolved",
    severity: "resolved",
    type: "medical",
    locationLabel: "Parking Lot B",
    latitude: 33.7475,
    longitude: -84.387,
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    description: "Minor injury — medics responded",
  },
  {
    id: "INC-1021",
    status: "active",
    severity: "critical",
    type: "fire",
    locationLabel: "North Concourse, Gate 8",
    latitude: 33.7495,
    longitude: -84.389,
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    description: "Smoke reported near concession stand",
  },
];
