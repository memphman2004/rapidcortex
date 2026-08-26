/**
 * Rapid Cortex — Map Constants
 *
 * Single source of truth for Mapbox Studio layer IDs, severity colors,
 * default coordinates, and layer-group→toggle mappings.
 *
 * IMPORTANT: Layer IDs must match exactly what is published in Mapbox Studio.
 * If a layer ID does not exist in the loaded style, RapidCortexMapCore will
 * log a dev warning and skip it — it will NOT crash.
 */

import type { ExpressionSpecification } from "mapbox-gl";

// ─── Mapbox style URL ─────────────────────────────────────────────────────────

/**
 * Resolved at runtime from env — never hard-code a token in source.
 * Prefer theme-specific URLs; fall back to NEXT_PUBLIC_MAPBOX_STYLE_URL (legacy).
 */
export const RC_STYLE_URL_DARK =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK ||
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_DARK ||
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL)) ||
  "mapbox://styles/memphman2004/cmr3afd69002401qq1uywfk5p";

export const RC_STYLE_URL_LIGHT =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT ||
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_LIGHT)) ||
  "mapbox://styles/memphman2004/cmsfheap9009w01s96hcr95b1";

/** @deprecated Prefer RC_STYLE_URL_DARK / resolveMapStyleUrl — kept for older callers */
export const RC_STYLE_URL = RC_STYLE_URL_DARK;

export function resolveMapStyleUrl(theme: "dark" | "light" = "dark"): string {
  return theme === "light" ? RC_STYLE_URL_LIGHT : RC_STYLE_URL_DARK;
}
// ─── Mapbox Studio layer IDs ──────────────────────────────────────────────────

/**
 * These are the canonical layer IDs that must be set in Mapbox Studio.
 * Rename layers to match exactly before publishing.
 */
export const STUDIO_LAYER_IDS = [
  "rc-agency-zones-fill",
  "rc-agency-zones-line",
  "rc-counties-line",
  "rc-state-boundaries-line",
  "rc-airports-circle",
  "rc-airports-label",
  "rc-campus-zones-fill",
  "rc-campus-zones-line",
  "rc-venue-zones-fill",
  "rc-venue-zones-line",
  "rc-incidents-points",
  "rc-selected-incident",
  "rc-psap-zones-fill",
  "rc-psap-zones-line",
  // Traffic — rename from "RC Live Traffic" / "RC Live Traffic Closures" in Studio
  "rc-live-traffic",
  "rc-live-traffic-closures",
] as const;

export type StudioLayerId = (typeof STUDIO_LAYER_IDS)[number];

// ─── Layer groups → toggle keys ───────────────────────────────────────────────

/**
 * Maps each UI toggle in MapLayerControl to one or more Mapbox layer IDs.
 * Studio layers that don't exist in the style are silently skipped.
 */
export const STUDIO_LAYER_GROUPS = {
  agencyZones:         ["rc-agency-zones-fill", "rc-agency-zones-line"] as StudioLayerId[],
  counties:            ["rc-counties-line"] as StudioLayerId[],
  stateBoundaries:     ["rc-state-boundaries-line"] as StudioLayerId[],
  airports:            ["rc-airports-circle", "rc-airports-label"] as StudioLayerId[],
  campusZones:         ["rc-campus-zones-fill", "rc-campus-zones-line"] as StudioLayerId[],
  venueZones:          ["rc-venue-zones-fill", "rc-venue-zones-line"] as StudioLayerId[],
  liveTraffic:         ["rc-live-traffic"] as StudioLayerId[],
  liveTrafficClosures: ["rc-live-traffic-closures"] as StudioLayerId[],
} as const;

export type StudioLayerGroupKey = keyof typeof STUDIO_LAYER_GROUPS;

// ─── Programmatic (GeoJSON) layer IDs ────────────────────────────────────────

// Source and layer IDs added by the app at runtime — NOT in Mapbox Studio.
export const LIVE_SOURCE_ID       = "rc-live-incidents";
export const LIVE_ACTIVE_LAYER    = "rc-live-incidents-circle";
export const LIVE_PULSE_LAYER     = "rc-live-incidents-pulse";
export const LIVE_RESOLVED_LAYER  = "rc-live-incidents-resolved";
export const CALLER_SOURCE_ID     = "rc-caller-location";
export const CALLER_LAYER         = "rc-caller-location-circle";
export const CALLER_LABEL_LAYER   = "rc-caller-location-label";

// ─── Incident severity → visual style ────────────────────────────────────────

export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",   // bright red
  high:     "#ef4444",   // RC red
  medium:   "#f59e0b",   // amber
  low:      "#3b82f6",   // blue
  resolved: "#6b7280",   // gray — dimmed
  default:  "#ef4444",
};

export const SEVERITY_RADIUS: Record<string, number> = {
  critical: 14,
  high:     11,
  medium:   9,
  low:      8,
  resolved: 6,
  default:  10,
};

export const SEVERITY_STROKE_WIDTH: Record<string, number> = {
  critical: 3,
  high:     2,
  medium:   2,
  low:      1.5,
  resolved: 1,
  default:  2,
};

// ─── Map defaults ─────────────────────────────────────────────────────────────

/** Default map center — Atlanta, GA (RC operational default) */
export const DEFAULT_CENTER: [number, number] = [-84.387982, 33.748995];
export const DEFAULT_ZOOM = 10;
export const INCIDENT_ZOOM = 15;    // Zoom level when flying to a selected incident
export const FLY_DURATION_MS = 1200;

export const OPS_SOURCE_ID = "rc-operational-overlays";
export const OPS_LAYER = "rc-operational-overlays-circle";
export const OPS_LABEL_LAYER = "rc-operational-overlays-label";

export const SECTION_SOURCE_ID = "rc-venue-sections";
export const SECTION_FILL_LAYER = "rc-venue-sections-fill";
export const SECTION_EXTRUSION_LAYER = "rc-venue-sections-extrusion";
export const SECTION_LINE_LAYER = "rc-venue-sections-line";
export const SECTION_LABEL_LAYER = "rc-venue-sections-label";

export const SECTION_STATUS_COLOR_EXPRESSION = [
  "match",
  ["get", "status"],
  "clear",
  "#10b981",
  "normal",
  "#10b981",
  "elevated",
  "#f59e0b",
  "attention",
  "#f59e0b",
  "incident",
  "#ef4444",
  "nominal",
  "#10b981",
  "alert",
  "#f59e0b",
  "closed",
  "#64748b",
  "#10b981",
] as ExpressionSpecification;

// ─── Mapbox expression helpers ────────────────────────────────────────────────

/**
 * Mapbox GL match expression that maps severity property to circle color.
 * Used in addLayer() paint properties.
 */
export const SEVERITY_COLOR_EXPRESSION = [
  "match",
  ["get", "severity"],
  "critical", SEVERITY_COLOR.critical,
  "high",     SEVERITY_COLOR.high,
  "medium",   SEVERITY_COLOR.medium,
  "low",      SEVERITY_COLOR.low,
  "resolved", SEVERITY_COLOR.resolved,
  SEVERITY_COLOR.default,
] as ExpressionSpecification;

export const SEVERITY_RADIUS_EXPRESSION = [
  "match",
  ["get", "severity"],
  "critical", 14,
  "high",     11,
  "medium",   9,
  "low",      8,
  "resolved", 6,
  10,
] as ExpressionSpecification;

// ─── Design tokens (matches existing RC dark theme) ───────────────────────────

export const MAP_TOKENS = {
  surface:    "#100e1a",
  surfaceAlt: "#141220",
  border:     "#1e1a30",
  red:        "#ef4444",
  amber:      "#f59e0b",
  blue:       "#3b82f6",
  green:      "#10b981",
  callerBlue: "#0ea5e9",
  text:       "#e4dff5",
  textMuted:  "#5a4d7a",
  textDim:    "#2d2445",
  popup_bg:   "#0f0d1c",
} as const;
