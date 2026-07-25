"use client";

import { useEffect, useState } from "react";
import type { Map } from "mapbox-gl";
import { LocationMarker } from "rapid-cortex-maps/components/LocationMarker";
import { RapidCortexMap } from "rapid-cortex-maps/components/RapidCortexMap";

function mapboxTokenOk(): boolean {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  return token.startsWith("pk.") && !token.includes("REPLACE");
}

export function MapboxIncidentMap({
  lat,
  lng,
  label,
  height = 380,
  zoom = 14,
  className,
  fill = false,
}: {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  zoom?: number;
  className?: string;
  /** When true, fill the parent (parent must have an explicit height). */
  fill?: boolean;
}) {
  const [mapInstance, setMapInstance] = useState<Map | null>(null);

  useEffect(() => {
    if (!mapInstance) return;
    // Mapbox often mounts before the flex layout settles — force a resize.
    const id = window.requestAnimationFrame(() => {
      try {
        mapInstance.resize();
      } catch {
        /* ignore */
      }
    });
    const onWinResize = () => {
      try {
        mapInstance.resize();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", onWinResize);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", onWinResize);
    };
  }, [mapInstance, fill, height]);

  if (!mapboxTokenOk()) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/30 bg-slate-950 px-6 py-8 text-center ${className ?? ""}`}
        style={fill ? { height: "100%", minHeight: 280 } : { height }}
      >
        <p className="text-sm font-semibold text-rose-300">Mapbox token not configured</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
          Set <code className="text-violet-300">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in SSM at{" "}
          <code className="text-violet-300">/rapidcortex/prod/mapbox/public-token</code> and redeploy the web app.
        </p>
        <p className="font-mono text-[11px] text-slate-500">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-700 ${fill ? "h-full min-h-0 w-full" : ""} ${className ?? ""}`}
      style={fill ? undefined : { height }}
    >
      <RapidCortexMap
        theme="dark"
        center={[lng, lat]}
        zoom={zoom}
        showControls
        className="h-full w-full"
        onMapLoad={setMapInstance}
      >
        <LocationMarker
          map={mapInstance}
          latitude={lat}
          longitude={lng}
          accuracy={60}
          confidence="medium"
          label={label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        />
      </RapidCortexMap>
    </div>
  );
}

export function MapModal({
  onClose,
  incidentId,
  lat,
  lng,
  label,
  callerNumber,
  zoom = 14,
}: {
  onClose: () => void;
  incidentId?: string;
  lat: number;
  lng: number;
  label?: string;
  callerNumber?: string;
  zoom?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const displayLabel =
    label ?? `${callerNumber ? `${callerNumber} · ` : ""}${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/85 p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Incident location map"
    >
      <div
        className="flex h-[min(96dvh,100%)] w-full max-w-[1600px] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Incident location</h3>
            {incidentId ? <p className="mt-0.5 font-mono text-[11px] text-slate-500">{incidentId}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-slate-500">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:text-slate-200"
              aria-label="Close map"
            >
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-2 sm:p-3">
          <MapboxIncidentMap
            lat={lat}
            lng={lng}
            label={displayLabel}
            fill
            zoom={zoom}
            className="h-full rounded-md"
          />
        </div>
      </div>
    </div>
  );
}
