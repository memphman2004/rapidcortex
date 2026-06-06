'use client';

import { useEffect, useState } from "react";

import { RapidCortexMap } from "../components/RapidCortexMap";
import { AppleMapView } from "./AppleMapView";
import type { LatLng, MapKitMapInstance, MapKitTokenProvider } from "./types";
import type { MapTheme } from "../types/map-types";

export interface HybridMapViewProps {
  center?: LatLng;
  zoom?: number;
  theme?: MapTheme;
  className?: string;
  preferAppleMaps?: boolean;
  isMac?: boolean;
  isMapKitAvailable?: () => Promise<boolean>;
  getMapKitToken?: MapKitTokenProvider;
  onMapLoad?: (map: MapKitMapInstance | import("mapbox-gl").Map) => void;
}

export function HybridMapView({
  center = { lat: 27.3364, lng: -82.5306 },
  zoom = 12,
  theme = "dark",
  className = "",
  preferAppleMaps = true,
  isMac = false,
  isMapKitAvailable,
  getMapKitToken,
  onMapLoad,
}: HybridMapViewProps) {
  const [useAppleMaps, setUseAppleMaps] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!preferAppleMaps || !isMac || !getMapKitToken) {
        if (!cancelled) {
          setUseAppleMaps(false);
          setIsChecking(false);
        }
        return;
      }

      try {
        const available = isMapKitAvailable ? await isMapKitAvailable() : true;
        if (!cancelled) setUseAppleMaps(available);
      } catch {
        if (!cancelled) setUseAppleMaps(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [preferAppleMaps, isMac, isMapKitAvailable, getMapKitToken]);

  if (isChecking) {
    return (
      <div className={`flex items-center justify-center bg-slate-950 ${className}`}>
        <div className="text-white text-sm">Initializing map…</div>
      </div>
    );
  }

  if (useAppleMaps && getMapKitToken) {
    return (
      <AppleMapView
        center={center}
        zoom={zoom}
        className={className}
        getMapKitToken={getMapKitToken}
        onMapLoad={onMapLoad}
      />
    );
  }

  return (
    <RapidCortexMap
      center={[center.lng, center.lat]}
      zoom={zoom}
      theme={theme}
      className={className}
      onMapLoad={onMapLoad}
    />
  );
}
