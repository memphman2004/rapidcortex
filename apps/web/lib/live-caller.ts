/**
 * Live Caller Location — GeoJSON + freshness helpers for MapLibre overlays.
 * Caller-shared GPS only; does not replace CAD / NG911 location.
 */

import {
  calculateLocationConfidence,
  calculateMovementDirection,
  metersPerSecondToMph,
  type PinpointLinkDispatcherDetail,
  type PinpointPing,
} from "rapid-cortex-shared";
import { createAccuracyCirclePolygon } from "rapid-cortex-maps";
import type {
  LiveCallerFreshness,
  LiveCallerSource,
  RCCallerLocation,
  RCLiveCaller,
  RCLiveCallerTrailPoint,
} from "@/components/maps/map-types";

export type { LiveCallerFreshness, LiveCallerSource, RCLiveCaller, RCLiveCallerTrailPoint };

export const LIVE_CALLER_LIVE_MS = 15_000;
export const LIVE_CALLER_STALE_MS = 60_000;

export type LiveCallerConfidence = "high" | "medium" | "low";

export interface LiveCallerResolved extends RCLiveCaller {
  freshness: LiveCallerFreshness;
  confidence: LiveCallerConfidence;
  ageMs: number;
  moving: boolean;
  headingLabel: string | null;
  speedMph: number | null;
}

const LIVE_SOURCES = new Set<string>(["gps", "sms", "pinpoint"]);

export function isLiveCallerSource(source: string | undefined | null): source is LiveCallerSource {
  return source != null && LIVE_SOURCES.has(source);
}

export function liveCallerFreshness(updatedAt: string, now = Date.now()): LiveCallerFreshness {
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return "lost";
  const age = now - ts;
  if (age <= LIVE_CALLER_LIVE_MS) return "live";
  if (age <= LIVE_CALLER_STALE_MS) return "stale";
  return "lost";
}

export function formatLiveCallerAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "just now";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function resolveLiveCaller(caller: RCLiveCaller, now = Date.now()): LiveCallerResolved {
  const ageMs = Math.max(0, now - Date.parse(caller.updatedAt));
  const freshness = liveCallerFreshness(caller.updatedAt, now);
  const accuracy = caller.accuracyMeters;
  const confidence: LiveCallerConfidence =
    accuracy != null && Number.isFinite(accuracy) ? calculateLocationConfidence(accuracy) : "medium";
  const moving = (caller.speedMps != null && caller.speedMps > 0.5) ||
    (caller.headingDeg != null && Number.isFinite(caller.headingDeg) && (caller.speedMps ?? 0) > 0.15);
  const headingLabel =
    caller.headingDeg != null && Number.isFinite(caller.headingDeg)
      ? calculateMovementDirection(caller.headingDeg)
      : null;
  const speedMph =
    caller.speedMps != null && Number.isFinite(caller.speedMps)
      ? metersPerSecondToMph(caller.speedMps)
      : null;
  return {
    ...caller,
    freshness,
    confidence,
    ageMs,
    moving,
    headingLabel: headingLabel === "stationary" ? null : headingLabel,
    speedMph,
  };
}

export function mergeLiveCallers(callers: RCLiveCaller[]): RCLiveCaller[] {
  const byId = new Map<string, RCLiveCaller>();
  for (const caller of callers) {
    if (caller.sessionClosed) continue;
    if (!Number.isFinite(caller.lat) || !Number.isFinite(caller.lng)) continue;
    const existing = byId.get(caller.id);
    if (!existing || Date.parse(caller.updatedAt) >= Date.parse(existing.updatedAt)) {
      byId.set(caller.id, caller);
    }
  }
  return [...byId.values()];
}

export function callerLocationToLiveCaller(loc: RCCallerLocation): RCLiveCaller | null {
  if (!isLiveCallerSource(loc.source)) return null;
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  const id =
    loc.incidentId?.trim() ||
    loc.callId?.trim() ||
    `caller:${loc.lng.toFixed(5)},${loc.lat.toFixed(5)}`;
  return {
    id,
    lat: loc.lat,
    lng: loc.lng,
    updatedAt: loc.updatedAt ?? "",
    accuracyMeters: loc.accuracyMeters,
    headingDeg: loc.headingDeg,
    speedMps: loc.speedMps,
    incidentId: loc.incidentId,
    callId: loc.callId,
    label: loc.label,
    source: loc.source,
    trail: loc.trail,
  };
}

const MAX_TRAIL = 40;

export function pinpointDetailToLiveCaller(
  detail: PinpointLinkDispatcherDetail,
): RCLiveCaller | null {
  const pings: PinpointPing[] = detail.pings ?? [];
  const last = pings[pings.length - 1];
  if (!last) return null;
  const closed = detail.status === "revoked" || detail.status === "expired";
  return {
    id: `pinpoint:${detail.linkId}`,
    lat: last.lat,
    lng: last.lng,
    updatedAt: last.capturedAt,
    accuracyMeters: last.accuracyM,
    headingDeg: last.headingDeg,
    speedMps: last.speedMps,
    incidentId: detail.incidentId,
    source: "pinpoint",
    trail: pings.slice(-MAX_TRAIL).map((ping) => ({
      lat: ping.lat,
      lng: ping.lng,
      at: ping.capturedAt,
    })),
    sessionClosed: closed,
  };
}

/**
 * Merge explicit live callers with a GPS `callerLocation` pin.
 * Report pins (manual / QR / NFC) stay on the static caller layer.
 */
export function collectLiveCallers(
  liveCallers: RCLiveCaller[] | undefined,
  callerLocation: RCCallerLocation | null | undefined,
  fallbackUpdatedAt: (id: string, coordKey: string) => string,
): RCLiveCaller[] {
  const fromPin = callerLocation ? callerLocationToLiveCaller(callerLocation) : null;
  const merged = mergeLiveCallers([...(liveCallers ?? []), ...(fromPin ? [fromPin] : [])]);
  return merged.map((caller) => {
    if (caller.updatedAt && Number.isFinite(Date.parse(caller.updatedAt))) return caller;
    const coordKey = `${caller.lng.toFixed(5)},${caller.lat.toFixed(5)}`;
    return { ...caller, updatedAt: fallbackUpdatedAt(caller.id, coordKey) };
  });
}

export function liveCallersToPointCollection(
  callers: LiveCallerResolved[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: callers.map((caller) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [caller.lng, caller.lat] as [number, number],
      },
      properties: {
        id: caller.id,
        incidentId: caller.incidentId ?? "",
        callId: caller.callId ?? "",
        label: caller.label ?? "Live caller",
        source: caller.source ?? "gps",
        freshness: caller.freshness,
        accuracyMeters: caller.accuracyMeters ?? -1,
        headingDeg: caller.headingDeg ?? -1,
        speedMps: caller.speedMps ?? -1,
        updatedAt: caller.updatedAt,
        confidence: caller.confidence,
        moving: caller.moving,
      },
    })),
  };
}

export function liveCallersToAccuracyCollection(
  callers: LiveCallerResolved[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: callers
      .filter((caller) => caller.accuracyMeters != null && caller.accuracyMeters > 0)
      .map((caller) => {
        const poly = createAccuracyCirclePolygon(caller.lat, caller.lng, caller.accuracyMeters!);
        return {
          ...poly,
          properties: {
            id: caller.id,
            freshness: caller.freshness,
          },
        };
      }),
  };
}

export function liveCallersToTrailCollection(
  callers: LiveCallerResolved[],
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const caller of callers) {
    const coords = (caller.trail ?? [])
      .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
      .map((pt) => [pt.lng, pt.lat] as [number, number]);
    if (coords.length === 0) {
      coords.push([caller.lng, caller.lat]);
    } else {
      const last = coords[coords.length - 1]!;
      if (last[0] !== caller.lng || last[1] !== caller.lat) {
        coords.push([caller.lng, caller.lat]);
      }
    }
    if (coords.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        id: caller.id,
        freshness: caller.freshness,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function freshnessColor(freshness: LiveCallerFreshness): string {
  if (freshness === "live") return "#38bdf8";
  if (freshness === "stale") return "#94a3b8";
  return "#64748b";
}

export function buildLiveCallerHoverHTML(caller: LiveCallerResolved): string {
  const color = freshnessColor(caller.freshness);
  const gps = `${caller.lat.toFixed(5)}, ${caller.lng.toFixed(5)}`;
  const accuracy =
    caller.accuracyMeters != null && caller.accuracyMeters >= 0
      ? `±${Math.round(caller.accuracyMeters)} m`
      : "unknown";
  const movementParts: string[] = [];
  if (caller.moving && caller.speedMph != null && caller.speedMph >= 0.5) {
    movementParts.push(`${caller.speedMph.toFixed(0)} mph`);
  }
  if (caller.headingLabel) movementParts.push(caller.headingLabel);
  if (caller.headingDeg != null && Number.isFinite(caller.headingDeg)) {
    movementParts.push(`${Math.round(caller.headingDeg)}°`);
  }
  const movement = movementParts.length > 0 ? movementParts.join(" · ") : "Stationary";
  const incident = caller.incidentId?.trim() ? escapeHtml(caller.incidentId) : "—";
  const callId = caller.callId?.trim() ? escapeHtml(caller.callId) : "—";
  const label = escapeHtml(caller.label?.trim() || "Caller-shared GPS");

  return `
    <div class="live-caller-hover-card" style="
      background:#0f0d1c;
      border:1px solid #1e1a30;
      border-top:3px solid ${color};
      border-radius:6px;
      padding:10px 12px;
      min-width:220px;
      max-width:300px;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="font-size:10px;font-weight:700;color:${color};letter-spacing:.06em;margin-bottom:4px">LIVE CALLER LOCATION</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:12px;font-weight:700;color:#e4dff5">${label}</span>
        <span style="font-size:10px;font-weight:700;color:${color};letter-spacing:.04em">${caller.freshness.toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums">${escapeHtml(gps)}</div>
      <div style="margin-top:8px;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11px">
        <span style="color:#64748b">Accuracy</span><span style="color:#e2e8f0">${escapeHtml(accuracy)}</span>
        <span style="color:#64748b">Updated</span><span style="color:#e2e8f0">${escapeHtml(formatLiveCallerAge(caller.ageMs))}</span>
        <span style="color:#64748b">Moving</span><span style="color:#e2e8f0">${escapeHtml(movement)}</span>
        <span style="color:#64748b">Confidence</span><span style="color:#e2e8f0">${escapeHtml(caller.confidence)}</span>
        <span style="color:#64748b">Incident</span><span style="color:#e2e8f0">${incident}</span>
        <span style="color:#64748b">Call ID</span><span style="color:#e2e8f0">${callId}</span>
      </div>
      <div style="margin-top:8px;font-size:10px;line-height:1.35;color:#64748b">
        Caller-shared GPS — does not replace CAD/NG911 location
      </div>
    </div>
  `;
}
