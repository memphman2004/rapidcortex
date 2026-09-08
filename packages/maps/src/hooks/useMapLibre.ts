'use client';

import { useEffect, useRef, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";

import {
  getMapAuthenticationOptions,
  isMapAuthReady,
  subscribeMapAuthReady,
} from "../utils/map-auth";
import { RAPID_CORTEX_MAP_STYLES } from "../utils/map-styles";

export interface UseMapLibreOptions {
  center?: [number, number]; // lng, lat
  zoom?: number;
  style?: string;
  interactive?: boolean;
}

/**
 * Instantiate a MapLibre GL map mounted in `containerRef`.
 * Consumers should memoize options if they inline objects.
 */
export function useMapLibre(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseMapLibreOptions = {},
) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    let cancelled = false;
    let instance: maplibregl.Map | null = null;

    const start = () => {
      const container = containerRef.current;
      if (cancelled || !container || mapRef.current) return;

      const o = optsRef.current;
      instance = new maplibregl.Map({
        container,
        style: o.style ?? RAPID_CORTEX_MAP_STYLES.dark,
        center: o.center ?? [-82.5306, 27.3364],
        zoom: o.zoom ?? 12,
        interactive: o.interactive !== false,
        attributionControl: {},
        ...getMapAuthenticationOptions(),
      });

      mapRef.current = instance;
      const onLoad = () => {
        setMap(instance);
        setIsLoaded(true);
      };
      instance.once("load", onLoad);
    };

    if (isMapAuthReady()) start();
    const unsub = subscribeMapAuthReady(start);

    return () => {
      cancelled = true;
      unsub();
      instance?.remove();
      mapRef.current = null;
      setMap(null);
      setIsLoaded(false);
    };
  }, [containerRef]);

  return { map, isLoaded, mapRef };
}
