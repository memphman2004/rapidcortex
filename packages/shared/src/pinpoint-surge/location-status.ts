import { PINPOINT_CONFIG } from "./constants.js";
import type { PinpointPing } from "./schemas.js";

/** Campus ops Pinpoint iQ location status (server-authoritative). */
export type PinpointIqLocationStatus =
  | "live"
  | "scan_only"
  | "stale"
  | "sharing_stopped"
  | "location_unavailable";

export type PinpointIqLocationStatusInput = {
  /** Whether any Pinpoint tracking session exists for the incident. */
  hasTrackingSession: boolean;
  /**
   * True when an original QR/NFC (or other fixed) scan location is available.
   * SCAN_ONLY is only allowed when this is true and no authorized live tracking exists.
   */
  hasScanLocation?: boolean;
  sessionStatus?: "active" | "revoked" | "expired" | string | null;
  consentGrantedAt?: string | null;
  expiresAt?: string | null;
  pings?: PinpointPing[] | null;
  /** Server "now" — inject in tests; defaults to Date.now(). */
  nowMs?: number;
  freshnessSeconds?: number;
};

export type PinpointIqLocationStatusView = {
  status: PinpointIqLocationStatus;
  label: string;
  description: string;
  lastLocationUpdateAt: string | null;
  locationAccuracyMeters: number | null;
  locationConsent: boolean;
  trackingSessionActive: boolean;
  lastKnownLocation: { lat: number; lng: number } | null;
};

const STATUS_COPY: Record<
  PinpointIqLocationStatus,
  { label: string; description: string }
> = {
  live: {
    label: "LIVE",
    description:
      "Caller has consented to location sharing. Position updates while the browser permits tracking.",
  },
  scan_only: {
    label: "SCAN ONLY",
    description:
      "Location reflects the original QR/NFC scan point, not necessarily the caller's current position.",
  },
  stale: {
    label: "STALE",
    description: "Last known location. Sharing was active but no recent updates have been received.",
  },
  sharing_stopped: {
    label: "SHARING STOPPED",
    description:
      "Caller stopped sharing, revoked permission, or the tracking session expired. Location is historical.",
  },
  location_unavailable: {
    label: "LOCATION UNAVAILABLE",
    description:
      "Caller consented to sharing, but the system has not received a valid GPS coordinate yet.",
  },
};

function lastPing(pings: PinpointPing[] | null | undefined): PinpointPing | null {
  if (!pings?.length) return null;
  return pings[pings.length - 1] ?? null;
}

/**
 * Resolve Pinpoint iQ ops status from session + pings.
 * Uses server receipt timestamps (`capturedAt`) for freshness — never trusts client device clocks alone.
 */
export function resolvePinpointIqLocationStatus(
  input: PinpointIqLocationStatusInput,
): PinpointIqLocationStatusView {
  const nowMs = input.nowMs ?? Date.now();
  const freshnessMs =
    (input.freshnessSeconds ?? PINPOINT_CONFIG.LIVE_FRESHNESS_SECONDS) * 1000;
  const ping = lastPing(input.pings);
  const lastLocationUpdateAt = ping?.capturedAt ?? null;
  const locationAccuracyMeters =
    ping?.accuracyM != null && Number.isFinite(ping.accuracyM) ? ping.accuracyM : null;
  const lastKnownLocation = ping ? { lat: ping.lat, lng: ping.lng } : null;
  const hasScanLocation = Boolean(input.hasScanLocation);
  const expiresMs = input.expiresAt ? Date.parse(input.expiresAt) : NaN;
  const expiredByTime = Number.isFinite(expiresMs) && expiresMs < nowMs;
  const sessionStatus = String(input.sessionStatus ?? "").toLowerCase();
  const sessionEnded =
    sessionStatus === "revoked" ||
    sessionStatus === "expired" ||
    expiredByTime;
  const trackingSessionActive =
    input.hasTrackingSession && !sessionEnded && (sessionStatus === "active" || sessionStatus === "");
  // Explicit consent timestamp, or an accepted GPS ping (SMS first-share records consent on capture).
  const consent = Boolean(input.consentGrantedAt) || Boolean(ping);

  let status: PinpointIqLocationStatus;

  if (input.hasTrackingSession && sessionEnded) {
    // Expired / revoked must never resolve to LIVE even if the last ping is fresh.
    status = "sharing_stopped";
  } else if (!trackingSessionActive) {
    // No authorized live tracking — SCAN_ONLY only when a fixed scan location exists.
    status = hasScanLocation ? "scan_only" : "location_unavailable";
  } else if (!ping) {
    // Sharing active but no accepted GPS yet.
    status = "location_unavailable";
  } else {
    const ageMs = nowMs - Date.parse(ping.capturedAt);
    status = Number.isFinite(ageMs) && ageMs <= freshnessMs ? "live" : "stale";
  }

  const copy = STATUS_COPY[status];
  return {
    status,
    label: copy.label,
    description: copy.description,
    lastLocationUpdateAt,
    locationAccuracyMeters,
    locationConsent: consent && status !== "scan_only",
    trackingSessionActive,
    lastKnownLocation,
  };
}

/** Human-readable age for ops cards ("8 seconds ago"). */
export function formatLocationUpdateAge(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return `${sec} second${sec === 1 ? "" : "s"} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  return `${hr} hour${hr === 1 ? "" : "s"} ago`;
}
