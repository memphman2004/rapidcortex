'use client';

import { useEffect, useRef } from "react";

import type { LocationSample } from "../types/map-types";

/**
 * `onSample` should be wrapped in `useCallback` by the caller to avoid churn.
 */
export function useLocationTracking(enabled: boolean, onSample: (sample: LocationSample) => void, options?: PositionOptions) {
  const watchIdRef = useRef<number | null>(null);
  const cbRef = useRef(onSample);
  cbRef.current = onSample;
  const optsRef = useRef<PositionOptions | undefined>(options);
  optsRef.current = options;

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;

    const o: PositionOptions = optsRef.current ?? {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        cbRef.current({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          capturedAtMs: pos.timestamp,
        }),
      () => {},
      o,
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);
}
