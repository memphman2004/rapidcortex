"use client";

/**
 * Compact incident location map for the dispatcher CAD workspace.
 * Uses the Rapid Cortex Dispatch Dark Studio style (911 Core).
 */
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";

export function IncidentContextMap({
  latitude,
  longitude,
  label = "Incident",
}: {
  latitude: number;
  longitude: number;
  label?: string;
}) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

  if (!mapboxToken) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
        Map tiles are unavailable — Mapbox token is not configured for this environment.
        <p className="mt-1 font-mono text-[11px] text-amber-200/80">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      </div>
    );
  }

  return (
    <div className="h-48 overflow-hidden rounded-lg border border-slate-700">
      <RapidCortexMap
        vertical="core"
        centerLat={latitude}
        centerLng={longitude}
        zoom={15}
        height="100%"
        showLayerControl
        // Street-level ops: traffic is the Studio overlay that actually paints here.
        // Counties/states in the published style max out at zoom 10 / 8.
        defaultLayers={{
          liveTraffic: true,
          liveTrafficClosures: true,
          airports: true,
        }}
        callerLocation={{
          lat: latitude,
          lng: longitude,
          label,
          source: "manual",
        }}
      />
    </div>
  );
}
