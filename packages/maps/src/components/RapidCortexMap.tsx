'use client';

import { useEffect, useRef, type ReactNode } from "react";
import maplibregl from "maplibre-gl";

import type { MapTheme } from "../types/map-types";
import { getMapAuthenticationOptions, isMapAuthReady, subscribeMapAuthReady } from "../utils/map-auth";
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
  onMapLoad?: (map: maplibregl.Map) => void;
  onMapClick?: (e: maplibregl.MapMouseEvent) => void;
}

function safeResize(map: maplibregl.Map | null) {
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
  const map = useRef<maplibregl.Map | null>(null);
  const skippedThemeEffect = useRef(true);
  const skippedCenterEffect = useRef(true);
  const skippedZoomEffect = useRef(true);
  const clickHandler = useRef<((e: maplibregl.MapMouseEvent) => void) | undefined>(undefined);

  useEffect(() => {
    clickHandler.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    let cancelled = false;
    let instance: maplibregl.Map | null = null;
    let observer: ResizeObserver | null = null;
    let raf = 0;
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let clickBound: ((e: maplibregl.MapMouseEvent) => void) | null = null;
    let kickResize: (() => void) | null = null;

    const start = () => {
      if (cancelled || !mapContainer.current || map.current) return;

      instance = new maplibregl.Map({
        container: mapContainer.current,
        style: RAPID_CORTEX_MAP_STYLES[theme],
        center,
        zoom,
        pitch,
        bearing,
        interactive,
        attributionControl: {},
        ...getMapAuthenticationOptions(),
      });

      map.current = instance;

      if (showControls) {
        instance.addControl(
          new maplibregl.NavigationControl({ visualizePitch: true }),
          "top-right",
        );
        instance.addControl(new maplibregl.FullscreenControl(), "top-right");
      }

      if (showScale) {
        instance.addControl(
          new maplibregl.ScaleControl({ maxWidth: 100, unit: "imperial" }),
          "bottom-left",
        );
      }

      clickBound = (e: maplibregl.MapMouseEvent) => clickHandler.current?.(e);
      instance.on("click", clickBound);

      kickResize = () => safeResize(instance);
      instance.once("load", () => {
        kickResize?.();
        if (onMapLoad && instance) onMapLoad(instance);
      });

      raf = window.requestAnimationFrame(() => {
        kickResize?.();
        window.requestAnimationFrame(() => kickResize?.());
      });
      t1 = window.setTimeout(() => kickResize?.(), 50);
      t2 = window.setTimeout(() => kickResize?.(), 250);
      t3 = window.setTimeout(() => kickResize?.(), 600);

      const observeTarget = rootRef.current ?? mapContainer.current;
      if (typeof ResizeObserver !== "undefined" && observeTarget && kickResize) {
        observer = new ResizeObserver(() => kickResize?.());
        observer.observe(observeTarget);
      }

      window.addEventListener("resize", kickResize);
    };

    if (isMapAuthReady()) start();
    const unsub = subscribeMapAuthReady(start);

    return () => {
      cancelled = true;
      unsub();
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      if (kickResize) window.removeEventListener("resize", kickResize);
      observer?.disconnect();
      if (instance && clickBound) instance.off("click", clickBound);
      instance?.remove();
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
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%", minHeight: "100%" }}
      />
      {children}
    </div>
  );
}
