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

    map.current.once("load", () => {
      if (map.current && onMapLoad) onMapLoad(map.current);
    });

    const handler = (e: mapboxgl.MapMouseEvent) => clickHandler.current?.(e);
    map.current.on("click", handler);

    return () => {
      if (map.current) map.current.off("click", handler);
      map.current?.remove();
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
    <div className={`relative size-full ${className}`.trim()}>
      <div ref={mapContainer} className="size-full min-h-[12rem]" />
      {children}
    </div>
  );
}
