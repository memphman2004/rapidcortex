'use client';

import { useEffect, useRef, useState, type RefObject } from "react";
import mapboxgl from "mapbox-gl";

import { ensureMapboxAccessToken } from "../utils/mapbox-env";

export interface UseMapboxOptions {
  center?: [number, number]; // lng, lat
  zoom?: number;
  style?: string;
  interactive?: boolean;
}

/**
 * Instantiate a Mapbox GL map mounted in `containerRef`.
 * Consumers should memoize options if they inline objects.
 */
export function useMapbox(containerRef: RefObject<HTMLDivElement | null>, options: UseMapboxOptions = {}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    ensureMapboxAccessToken();

    const o = optsRef.current;
    const instance = new mapboxgl.Map({
      container,
      style: o.style ?? "mapbox://styles/mapbox/dark-v11",
      center: o.center ?? [-82.5306, 27.3364],
      zoom: o.zoom ?? 12,
      interactive: o.interactive !== false,
    });

    mapRef.current = instance;
    const onLoad = () => {
      setMap(instance);
      setIsLoaded(true);
    };
    instance.once("load", onLoad);

    return () => {
      instance.off("load", onLoad);
      instance.remove();
      mapRef.current = null;
      setMap(null);
      setIsLoaded(false);
    };
  }, [containerRef]);

  return { map, isLoaded, mapRef };
}
