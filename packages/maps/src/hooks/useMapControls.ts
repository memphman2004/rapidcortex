import { useCallback } from "react";
import type { LngLatBoundsLike, Map } from "mapbox-gl";

/** Imperative helpers for parent components (timeline fly-to, etc.). */
type FlyToOptions = Parameters<Map["flyTo"]>[0];

export function useMapControls(map: Map | null) {
  const flyTo = useCallback(
    (opts: FlyToOptions) => {
      if (!map) return;
      map.flyTo({ essential: true, ...opts });
    },
    [map],
  );

  const fitBounds = useCallback(
    (bounds: LngLatBoundsLike, padding = 48) => {
      if (!map) return;
      map.fitBounds(bounds, { padding, animate: true });
    },
    [map],
  );

  return { flyTo, fitBounds };
}
