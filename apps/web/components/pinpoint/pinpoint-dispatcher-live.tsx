"use client";

import { useEffect, useState } from "react";
import type { Map } from "mapbox-gl";
import { LocationMarker } from "rapid-cortex-maps/components/LocationMarker";
import { RapidCortexMap } from "rapid-cortex-maps/components/RapidCortexMap";
import type { PinpointLinkDispatcherDetail, PinpointPing } from "rapid-cortex-shared/pinpoint-surge";
import {
  calculateLocationConfidence,
  calculateMovementDirection,
  metersPerSecondToMph,
} from "rapid-cortex-shared/pinpoint-surge";
import { PinpointLocationTimeline } from "@/components/pinpoint/pinpoint-location-timeline";

function confidenceBadgeClass(level: "high" | "medium" | "low"): string {
  if (level === "high") return "bg-emerald-900/60 text-emerald-300";
  if (level === "medium") return "bg-amber-900/60 text-amber-200";
  return "bg-rose-900/60 text-rose-200";
}

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

export function PinpointDispatcherLive({ detail }: { detail: PinpointLinkDispatcherDetail }) {
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [focusPing, setFocusPing] = useState<PinpointPing | null>(null);
  const pings = detail.pings;
  const last = pings.length ? pings[pings.length - 1]! : null;
  const prev = pings.length > 1 ? pings[pings.length - 2]! : null;
  const active = focusPing ?? last;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

  useEffect(() => {
    if (last) setFocusPing(last);
  }, [last?.capturedAt, last?.lat, last?.lng]);

  if (!last) {
    return (
      <p className="mt-2 text-xs text-slate-500">Waiting for caller to share location…</p>
    );
  }

  const confidence = active?.accuracyM != null ? calculateLocationConfidence(active.accuracyM) : "medium";
  const movement = active ? movementLabel(active, prev) : null;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded px-2 py-0.5 font-semibold uppercase ${confidenceBadgeClass(confidence)}`}>
          {confidence} confidence
        </span>
        {movement ? <span className="text-slate-400">Movement: {movement}</span> : null}
        <span className="text-slate-500">
          Updated {new Date(active!.capturedAt).toLocaleTimeString()}
        </span>
      </div>
      {mapboxToken && active ? (
        <div className="h-[200px] overflow-hidden rounded-md border border-slate-800">
          <RapidCortexMap
            theme="dark"
            center={[active.lng, active.lat]}
            zoom={16}
            showControls
            onMapLoad={setMapInstance}
          >
            <LocationMarker
              map={mapInstance}
              latitude={active.lat}
              longitude={active.lng}
              accuracy={active.accuracyM ?? 60}
              confidence={confidence}
            />
          </RapidCortexMap>
        </div>
      ) : active ? (
        <p className="font-mono text-[11px] text-slate-400">
          {active.lat.toFixed(5)}, {active.lng.toFixed(5)}
          {active.accuracyM != null ? ` ±${Math.round(active.accuracyM)}m` : ""}
        </p>
      ) : null}
      {pings.length > 1 ? (
        <div className="max-h-36 overflow-hidden rounded-md border border-slate-800">
          <PinpointLocationTimeline pings={pings} onLocationSelect={setFocusPing} />
        </div>
      ) : null}
    </div>
  );
}
