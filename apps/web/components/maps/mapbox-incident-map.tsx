"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map } from "mapbox-gl";
import { LocationMarker } from "rapid-cortex-maps/components/LocationMarker";
import { RapidCortexMap } from "rapid-cortex-maps/components/RapidCortexMap";

function mapboxTokenOk(): boolean {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  return token.startsWith("pk.") && !token.includes("REPLACE");
}

export function buildMapPreviewUrl(opts: {
  lat: number;
  lng: number;
  label?: string;
  incidentId?: string;
  zoom?: number;
}): string {
  const qs = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
  });
  if (opts.label?.trim()) qs.set("label", opts.label.trim());
  if (opts.incidentId?.trim()) qs.set("incidentId", opts.incidentId.trim());
  if (opts.zoom != null) qs.set("zoom", String(opts.zoom));
  return `/map-preview?${qs.toString()}`;
}

/** Opens a real browser window that can be dragged to a second monitor. */
export function openMapPreviewWindow(opts: {
  lat: number;
  lng: number;
  label?: string;
  incidentId?: string;
  zoom?: number;
}): Window | null {
  const url = buildMapPreviewUrl(opts);
  const features = [
    "popup=yes",
    "width=1280",
    "height=900",
    "left=80",
    "top=60",
    "menubar=no",
    "toolbar=no",
    "location=yes",
    "status=no",
    "resizable=yes",
    "scrollbars=no",
  ].join(",");
  // Do not pass noopener here — it makes window.open return null so we cannot
  // detect popup blockers (and would open both a window and the modal).
  return window.open(url, "rc-incident-map", features);
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);

  useEffect(() => {
    if (!mapInstance) return;

    const resize = () => {
      try {
        mapInstance.resize();
      } catch {
        /* ignore */
      }
    };

    // Modal / popup flex layout often settles after first paint.
    const raf = window.requestAnimationFrame(() => {
      resize();
      window.requestAnimationFrame(resize);
    });
    const t1 = window.setTimeout(resize, 50);
    const t2 = window.setTimeout(resize, 250);

    window.addEventListener("resize", resize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && shellRef.current) {
      observer = new ResizeObserver(() => resize());
      observer.observe(shellRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", resize);
      observer?.disconnect();
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
      ref={shellRef}
      className={`relative overflow-hidden rounded-lg border border-slate-700 ${
        fill ? "h-full min-h-0 w-full" : ""
      } ${className ?? ""}`}
      style={fill ? { height: "100%", width: "100%", minHeight: 0 } : { height }}
    >
      {/* Absolute host so Mapbox always gets a non-zero box (flex % height is unreliable). */}
      <div
        className="absolute inset-0"
        style={{ top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" }}
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function popOut() {
    openMapPreviewWindow({
      lat,
      lng,
      label: displayLabel,
      incidentId,
      zoom,
    });
    onClose();
  }

  // Portal to body so drag-panel `transform` ancestors cannot trap `position: fixed`
  // (that was collapsing the modal into a thin strip inside a panel).
  if (!mounted) return null;

  return createPortal(
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
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Incident location</h3>
            {incidentId ? (
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{incidentId}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={popOut}
              className="rounded-md border border-sky-700/60 bg-sky-950/40 px-2.5 py-1 text-[11px] font-medium text-sky-200 hover:bg-sky-900/50"
              title="Open in a separate window you can drag to another monitor"
            >
              Pop out
            </button>
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
        <div className="relative min-h-0 flex-1 p-2 sm:p-3">
          <div className="absolute inset-2 sm:inset-3">
            <MapboxIncidentMap
              lat={lat}
              lng={lng}
              label={displayLabel}
              fill
              zoom={zoom}
              className="rounded-md border-0"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
