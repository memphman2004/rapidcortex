"use client";

import { useState } from "react";
import type { Map } from "mapbox-gl";
import { LocationMarker } from "rapid-cortex-maps/components/LocationMarker";
import { RapidCortexMap } from "rapid-cortex-maps/components/RapidCortexMap";

export function IncidentContextMap({
  latitude,
  longitude,
  label = "Incident",
}: {
  latitude: number;
  longitude: number;
  label?: string;
}) {
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
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
        theme="dark"
        center={[longitude, latitude]}
        zoom={15}
        showControls
        onMapLoad={setMapInstance}
      >
        <LocationMarker
          map={mapInstance}
          latitude={latitude}
          longitude={longitude}
          accuracy={60}
          confidence="medium"
          label={label}
        />
      </RapidCortexMap>
    </div>
  );
}
