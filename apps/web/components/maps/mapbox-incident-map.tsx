"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";

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
  const mapReadyRef = useRef(false);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const resize = () => {
      // Mapbox listens to window resize; trigger after flex layout settles.
      window.dispatchEvent(new Event("resize"));
    };

    const raf = window.requestAnimationFrame(() => {
      resize();
      window.requestAnimationFrame(resize);
    });
    const t1 = window.setTimeout(resize, 50);
    const t2 = window.setTimeout(resize, 250);

    window.addEventListener("resize", resize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => resize());
      observer.observe(el);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", resize);
      observer?.disconnect();
    };
  }, [fill, height]);

  if (!mapboxTokenOk()) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/30 bg-slate-950 px-6 py-8 text-center ${className ?? ""}`}
        style={fill ? { height: "100%", minHeight: 280 } : { height }}
      >
        <p className="text-sm font-semibold text-rose-300">Map isn’t configured</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
          Map isn’t available in this environment. Contact Rapid Cortex support.
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
      <div
        className="absolute inset-0"
        style={{ top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" }}
      >
        <RapidCortexMap
          vertical="core"
          centerLat={lat}
          centerLng={lng}
          zoom={zoom}
          height="100%"
          showLayerControl
          className="h-full w-full"
          onMapReady={() => {
            mapReadyRef.current = true;
            window.dispatchEvent(new Event("resize"));
          }}
          defaultLayers={{
            liveTraffic: true,
            liveTrafficClosures: true,
            airports: true,
          }}
          callerLocation={{
            lat,
            lng,
            label: label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            source: "manual",
          }}
        />
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Incident map"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">
              Rapid Cortex · Map
            </p>
            <h2 className="truncate text-sm font-semibold text-white">
              {label ?? "Incident location"}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
              {incidentId ? `${incidentId} · ` : ""}
              {lat.toFixed(5)}, {lng.toFixed(5)}
              {callerNumber ? ` · ${callerNumber}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 p-3" style={{ height: "min(70vh, 640px)" }}>
          <MapboxIncidentMap
            lat={lat}
            lng={lng}
            label={label}
            zoom={zoom}
            fill
            className="rounded-lg"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
