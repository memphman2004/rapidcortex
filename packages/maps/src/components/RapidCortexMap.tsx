'use client';

import { useEffect, useRef, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";

import type { MapTheme } from "../types/map-types";
import { ensureMapboxAccessToken } from "../utils/mapbox-env";
import { RAPID_CORTEX_MAP_STYLES } from "../utils/map-styles";

export type { MapTheme } from "../types/map-types";

export interface RapidCortexMapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  pitch?: number;
  bearing?: number;
  theme?: MapTheme;
  interactive?: boolean;
  showControls?: boolean;
  showScale?: boolean;
  className?: string;
  children?: ReactNode;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onMapClick?: (e: mapboxgl.MapMouseEvent) => void;
}

function safeResize(map: mapboxgl.Map | null) {
  if (!map) return;
  try {
    map.resize();
  } catch {
    /* map may already be removed */
  }
}

/**
 * Base Rapid Cortex map — LiveLocation, Surge View, Event Command, workstations.
 * Switching `theme` resets the base style; recreate overlay layers after `onMapLoad` if you depend on custom sources.
 */
export function RapidCortexMap({
  center = [-82.5306, 27.3364],
  zoom = 12,
  pitch = 0,
  bearing = 0,
  theme = "dark",
  interactive = true,
  showControls = true,
  showScale = false,
  className = "",
  children,
  onMapLoad,
  onMapClick,
}: RapidCortexMapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const skippedThemeEffect = useRef(true);
  const skippedCenterEffect = useRef(true);
  const skippedZoomEffect = useRef(true);
  const clickHandler = useRef<((e: mapboxgl.MapMouseEvent) => void) | undefined>(undefined);

  useEffect(() => {
    clickHandler.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    ensureMapboxAccessToken();

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: RAPID_CORTEX_MAP_STYLES[theme],
      center,
      zoom,
      pitch,
      bearing,
      interactive,
      attributionControl: false,
    });

    if (showControls) {
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );
      map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
    }

    if (showScale) {
      map.current.addControl(
        new mapboxgl.ScaleControl({ maxWidth: 100, unit: "imperial" }),
        "bottom-left",
      );
    }

    map.current.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: "© Rapid Cortex · © Mapbox",
      }),
      "bottom-right",
    );

    const instance = map.current;

    const handler = (e: mapboxgl.MapMouseEvent) => clickHandler.current?.(e);
    instance.on("click", handler);

    // Layout often settles after first paint (flex/modal/panel). Resize aggressively.
    const kickResize = () => safeResize(instance);
    instance.once("load", () => {
      kickResize();
      if (onMapLoad) onMapLoad(instance);
    });

    const raf = window.requestAnimationFrame(() => {
      kickResize();
      window.requestAnimationFrame(kickResize);
    });
    const t1 = window.setTimeout(kickResize, 50);
    const t2 = window.setTimeout(kickResize, 250);
    const t3 = window.setTimeout(kickResize, 600);

    let observer: ResizeObserver | null = null;
    const observeTarget = rootRef.current ?? mapContainer.current;
    if (typeof ResizeObserver !== "undefined" && observeTarget) {
      observer = new ResizeObserver(() => kickResize());
      observer.observe(observeTarget);
    }

    window.addEventListener("resize", kickResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("resize", kickResize);
      observer?.disconnect();
      instance.off("click", handler);
      instance.remove();
      map.current = null;
    };
    // Intentionally mount once — prop changes handled below.
     
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (skippedThemeEffect.current) {
      skippedThemeEffect.current = false;
      return;
    }
    map.current.setStyle(RAPID_CORTEX_MAP_STYLES[theme]);
    map.current.once("load", () => {
      if (!map.current) return;
      safeResize(map.current);
      if (onMapLoad) onMapLoad(map.current);
    });
     
  }, [theme, onMapLoad]);

  useEffect(() => {
    if (!map.current) return;
    if (skippedCenterEffect.current) {
      skippedCenterEffect.current = false;
      return;
    }
    map.current.flyTo({
      center,
      duration: 800,
      essential: true,
    });
     
  }, [center[0], center[1]]);

  useEffect(() => {
    if (!map.current) return;
    if (skippedZoomEffect.current) {
      skippedZoomEffect.current = false;
      return;
    }
    map.current.setZoom(zoom);
     
  }, [zoom]);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full min-h-0 ${className}`.trim()}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Explicit 100% box — avoid min-height-only hosts that leave Mapbox canvas as a strip. */}
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%", minHeight: "100%" }}
      />
      {children}
    </div>
  );
}
