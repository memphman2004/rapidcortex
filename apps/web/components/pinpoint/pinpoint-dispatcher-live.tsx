"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map } from "maplibre-gl";
import { LocationMarker } from "rapid-cortex-maps/components/LocationMarker";
import { RapidCortexMap } from "rapid-cortex-maps/components/RapidCortexMap";
import type {
  PinpointIqLocationStatus,
  PinpointLinkDispatcherDetail,
  PinpointPing,
} from "rapid-cortex-shared/pinpoint-surge";
import {
  calculateLocationConfidence,
  calculateMovementDirection,
  metersPerSecondToMph,
  resolvePinpointIqLocationStatus,
} from "rapid-cortex-shared/pinpoint-surge";
import { PinpointLocationTimeline } from "@/components/pinpoint/pinpoint-location-timeline";
import { useTheme } from "@/lib/theme/theme-context";

export type ScanMapLocation = {
  lat: number;
  lng: number;
  label?: string;
};

function movementLabel(ping: PinpointPing, prev: PinpointPing | null): string | null {
  if (ping.speedMps != null && ping.speedMps > 0.5) {
    const mph = metersPerSecondToMph(ping.speedMps);
    const dir = calculateMovementDirection(ping.headingDeg);
    return `${mph.toFixed(0)} mph ${dir !== "stationary" ? dir : ""}`.trim();
  }
  if (prev && ping.headingDeg != null) {
    return calculateMovementDirection(ping.headingDeg);
  }
  return null;
}

function markerConfidenceForStatus(
  status: PinpointIqLocationStatus,
  accuracyM?: number,
): "high" | "medium" | "low" {
  if (status === "live") {
    return accuracyM != null ? calculateLocationConfidence(accuracyM) : "high";
  }
  if (status === "stale") return "medium";
  if (status === "scan_only") return "low";
  return "medium";
}

function callerMarkerLabel(status: PinpointIqLocationStatus): string {
  switch (status) {
    case "live":
      return "Live caller";
    case "stale":
      return "Last known location";
    case "sharing_stopped":
      return "Last authorized location";
    case "location_unavailable":
      return "Caller (no GPS yet)";
    default:
      return "Caller";
  }
}

export function PinpointDispatcherLive({
  detail,
  scanLocation,
}: {
  detail: PinpointLinkDispatcherDetail;
  /** Original QR/NFC coordinates when known — kept visually distinct from caller GPS. */
  scanLocation?: ScanMapLocation | null;
}) {
  const { theme } = useTheme();
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [focusPing, setFocusPing] = useState<PinpointPing | null>(null);
  const pings = detail.pings;
  const last = pings.length ? pings[pings.length - 1]! : null;
  const prev = pings.length > 1 ? pings[pings.length - 2]! : null;
  const active = focusPing ?? last;

  const statusView = useMemo(
    () =>
      resolvePinpointIqLocationStatus({
        hasTrackingSession: true,
        hasScanLocation: Boolean(scanLocation),
        sessionStatus: detail.status,
        consentGrantedAt: detail.consentGrantedAt,
        expiresAt: detail.expiresAt,
        pings: detail.pings,
        // Prefer server view fields when present, but recompute so SCAN_ONLY /
        // freshness rules stay aligned with client scan-location knowledge.
        ...(detail.locationStatusView
          ? {
              // keep pings/session from detail; view is recomputed below
            }
          : null),
      }),
    [detail, scanLocation],
  );

  useEffect(() => {
    if (last) setFocusPing(last);
  }, [last?.capturedAt, last?.lat, last?.lng]);

  if (!last && !scanLocation) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        {statusView.status === "location_unavailable"
          ? "Caller consented — waiting for a GPS fix. Original scan location is shown separately when available."
          : "Waiting for caller to share location…"}
      </p>
    );
  }

  const movement = active ? movementLabel(active, prev) : null;
  const centerLng = active?.lng ?? scanLocation!.lng;
  const centerLat = active?.lat ?? scanLocation!.lat;
  const callerConfidence = active
    ? markerConfidenceForStatus(statusView.status, active.accuracyM)
    : "medium";

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {movement && statusView.status === "live" ? (
          <span className="text-slate-400">Movement: {movement}</span>
        ) : null}
        {statusView.status === "stale" ? (
          <span className="font-medium text-amber-300">Last known location — not live</span>
        ) : null}
        {statusView.status === "sharing_stopped" ? (
          <span className="font-medium text-slate-400">Historical — sharing stopped</span>
        ) : null}
      </div>
      <div className="h-[200px] overflow-hidden rounded-md border border-slate-800">
        <RapidCortexMap
          theme={theme}
          center={[centerLng, centerLat]}
          zoom={16}
          showControls
          onMapLoad={setMapInstance}
        >
          {scanLocation ? (
            <LocationMarker
              map={mapInstance}
              latitude={scanLocation.lat}
              longitude={scanLocation.lng}
              accuracy={25}
              confidence="low"
              label={scanLocation.label ?? "Registered Safety Point"}
            />
          ) : null}
          {active && statusView.status !== "scan_only" ? (
            <LocationMarker
              map={mapInstance}
              latitude={active.lat}
              longitude={active.lng}
              accuracy={active.accuracyM ?? 60}
              confidence={callerConfidence}
              heading={active.headingDeg}
              speed={active.speedMps}
              label={callerMarkerLabel(statusView.status)}
            />
          ) : null}
        </RapidCortexMap>
      </div>
      {pings.length > 1 ? (
        <div className="max-h-36 overflow-hidden rounded-md border border-slate-800">
          <PinpointLocationTimeline pings={pings} onLocationSelect={setFocusPing} />
        </div>
      ) : null}
    </div>
  );
}
