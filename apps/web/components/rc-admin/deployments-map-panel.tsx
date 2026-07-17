"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon } from "lucide-react";
import { RapidCortexMap } from "rapid-cortex-maps";
import {
  fetchPlatformDeploymentsMap,
  type AgencyDeploymentsMapPayload,
} from "@/lib/api";
import { isDeploymentsMapEnabled } from "@/lib/runtime-flags";

const US_CENTER: [number, number] = [-98.5795, 39.8283];

const STATUS_COLOR: Record<string, string> = {
  active: "#34d399",
  pilot: "#38bdf8",
  draft: "#94a3b8",
  suspended: "#fbbf24",
  archived: "#64748b",
};

const VERTICAL_RING: Record<string, string> = {
  core: "#a78bfa",
  campus: "#34d399",
  venue: "#f59e0b",
  hospital: "#2dd4bf",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markerColor(status: string, vertical?: string): { fill: string; ring: string } {
  return {
    fill: STATUS_COLOR[status] ?? "#94a3b8",
    ring: VERTICAL_RING[vertical ?? "core"] ?? VERTICAL_RING.core,
  };
}

function AgencyPin({
  map,
  marker,
}: {
  map: mapboxgl.Map | null;
  marker: AgencyDeploymentsMapPayload["markers"][number];
}) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const mount = () => {
      const { fill, ring } = markerColor(marker.status, marker.vertical);
      const el = document.createElement("div");
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${fill};
        border: 2px solid ${ring};
        box-shadow: 0 0 8px ${fill}66;
        cursor: pointer;
        transition: transform 0.15s ease;
      `;
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.5)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      const place = [marker.city, marker.state].filter(Boolean).join(", ");
      const popup = new mapboxgl.Popup({
        offset: 14,
        closeButton: false,
        maxWidth: "240px",
        className: "rc-map-popup",
      }).setHTML(`
        <div style="background:#0f1117;border:1px solid #1e1b2e;border-radius:6px;padding:10px 12px;font-family:inherit;">
          <div style="font-size:12px;font-weight:700;color:#e2e8f0;margin-bottom:4px;">${escapeHtml(marker.name)}</div>
          <div style="font-size:10px;color:#64748b;margin-bottom:4px;font-family:ui-monospace,monospace;">${escapeHtml(marker.agencyId)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">${escapeHtml(place || marker.state)} · ${escapeHtml(marker.status)}${marker.vertical ? ` · ${escapeHtml(marker.vertical)}` : ""}</div>
          <a href="/rc-admin/agencies/${encodeURIComponent(marker.agencyId)}/features" style="display:block;font-size:10px;color:#a78bfa;text-decoration:none;font-weight:600;">Open agency →</a>
        </div>
      `);

      const next = new mapboxgl.Marker({ element: el })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map);
      markerRef.current?.remove();
      markerRef.current = next;
    };

    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);

    return () => {
      map.off("load", mount);
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map, marker]);

  return null;
}

function useFitBounds(
  map: mapboxgl.Map | null,
  points: Array<{ latitude: number; longitude: number }>,
) {
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({
        center: [points[0].longitude, points[0].latitude],
        zoom: 6,
        duration: 700,
      });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    for (const p of points) bounds.extend([p.longitude, p.latitude]);
    map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 700 });
  }, [map, points]);
}

export type DeploymentsMapPanelProps = {
  /** Compact preview for the RC Admin dashboard home. */
  compact?: boolean;
  className?: string;
};

export function DeploymentsMapPanel({ compact = false, className = "" }: DeploymentsMapPanelProps) {
  const enabled = isDeploymentsMapEnabled();
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["platform", "deployments-map"],
    queryFn: fetchPlatformDeploymentsMap,
    enabled,
    retry: false,
  });

  const markers = query.data?.markers ?? [];
  const missing = query.data?.missingCoordinatesCount ?? 0;
  const total = query.data?.totalAgencies ?? 0;

  useEffect(() => {
    if (!map) return;
    const onError = () => setMapError("Map failed to load.");
    map.on("error", onError);
    return () => {
      map.off("error", onError);
    };
  }, [map]);

  useFitBounds(map, markers);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  const tokenMissing = !token || token === "pk.REPLACE_WITH_REAL_TOKEN";
  const height = compact ? 220 : 560;

  const legend = useMemo(
    () =>
      (
        [
          ["active", "Active"],
          ["pilot", "Pilot"],
          ["draft", "Draft"],
          ["suspended", "Suspended"],
        ] as const
      ).map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: STATUS_COLOR[key] }}
          />
          {label}
        </span>
      )),
    [],
  );

  if (!enabled) return null;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-3.5 w-3.5 text-violet-400" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            National deployments
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-slate-400">
            {markers.length} mapped
            {total > 0 ? ` · ${missing} missing HQ` : null}
          </span>
          {compact ? (
            <Link
              href="/rc-admin/deployments-map"
              className="text-[11px] hover:opacity-90"
              style={{ color: "var(--role-accent, #a78bfa)" }}
            >
              Open map →
            </Link>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div className="flex flex-wrap gap-3 border-b border-slate-800/80 px-4 py-2">{legend}</div>
      ) : null}

      <div className="relative" style={{ height }}>
        {tokenMissing ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            Set <code className="mx-1 text-violet-300">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to
            render the deployments map.
          </div>
        ) : query.isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading deployments…
          </div>
        ) : query.isError ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300">
            {query.error instanceof Error ? query.error.message : "Could not load deployments map"}
          </div>
        ) : mapError ? (
          <div className="flex h-full items-center justify-center text-sm text-rose-300">{mapError}</div>
        ) : markers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
            <p>No agency HQ coordinates yet.</p>
            <p className="text-xs text-slate-600">
              Set latitude/longitude on create agency or the agency profile to pin tenants here.
            </p>
          </div>
        ) : (
          <RapidCortexMap
            center={US_CENTER}
            zoom={3.4}
            theme="dark"
            showControls={!compact}
            className="h-full w-full"
            onMapLoad={setMap}
          >
            {markers.map((m) => (
              <AgencyPin key={m.agencyId} map={map} marker={m} />
            ))}
          </RapidCortexMap>
        )}
      </div>
    </div>
  );
}
