"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MapboxIncidentMap } from "@/components/maps/mapbox-incident-map";

function MapPreviewContent() {
  const params = useSearchParams();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const zoomRaw = Number(params.get("zoom") ?? "14");
  const label = params.get("label")?.trim() || undefined;
  const incidentId = params.get("incidentId")?.trim() || undefined;
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 14;

  const valid = useMemo(
    () => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180,
    [lat, lng],
  );

  if (!valid) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-slate-950 px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-rose-300">Invalid map coordinates</p>
          <p className="mt-2 text-xs text-slate-500">
            Expected <code className="text-slate-400">?lat=&lng=</code> query parameters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-slate-950 text-slate-200">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">
            Rapid Cortex · Map
          </p>
          <h1 className="truncate text-sm font-semibold text-white">
            {label ?? "Incident location"}
          </h1>
          {incidentId ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{incidentId}</p>
          ) : null}
        </div>
        <p className="shrink-0 font-mono text-[11px] text-slate-500">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      </header>
      <main className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <MapboxIncidentMap
            lat={lat}
            lng={lng}
            label={label}
            fill
            zoom={zoom}
            className="rounded-none border-0"
          />
        </div>
      </main>
    </div>
  );
}

export default function MapPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-dvw items-center justify-center bg-slate-950 text-sm text-slate-400">
          Loading map…
        </div>
      }
    >
      <MapPreviewContent />
    </Suspense>
  );
}
