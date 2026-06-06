'use client';

import { useEffect, useRef, useState } from "react";

import { loadMapKitJs } from "./load-mapkit";
import type { LatLng, MapKitMapInstance, MapKitTokenProvider } from "./types";

export interface AppleMapViewProps {
  center?: LatLng;
  zoom?: number;
  className?: string;
  getMapKitToken: MapKitTokenProvider;
  onMapLoad?: (map: MapKitMapInstance) => void;
}

function cameraDistanceFromZoom(zoom: number): number {
  return Math.max(200, 40_000 / 2 ** zoom);
}

export function AppleMapView({
  center = { lat: 27.3364, lng: -82.5306 },
  zoom = 12,
  className = "",
  getMapKitToken,
  onMapLoad,
}: AppleMapViewProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<MapKitMapInstance | null>(null);
  const [error, setError] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    let cancelled = false;

    const initializeMap = async () => {
      try {
        await loadMapKitJs();
        const token = await getMapKitToken();

        await window.mapkit.init({
          authorizationCallback: (done) => {
            done(token);
          },
          language: "en",
        });

        if (cancelled || !mapContainer.current) return;

        const map = new window.mapkit.Map(mapContainer.current, {
          center: new window.mapkit.Coordinate(center.lat, center.lng),
          cameraDistance: cameraDistanceFromZoom(zoom),
          colorScheme: window.mapkit.Map.ColorSchemes.Dark,
          showsCompass: window.mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          showsZoomControl: true,
          showsUserLocation: false,
          showsScale: window.mapkit.FeatureVisibility.Visible,
        });

        mapInstance.current = map;
        setIsInitializing(false);
        onMapLoad?.(map);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "MapKit initialization failed");
          setIsInitializing(false);
        }
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, [center.lat, center.lng, getMapKitToken, onMapLoad, zoom]);

  useEffect(() => {
    if (!mapInstance.current) return;
    const coord = new window.mapkit.Coordinate(center.lat, center.lng);
    mapInstance.current.setCenterAnimated(coord);
  }, [center.lat, center.lng]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-950 ${className}`}>
        <div className="text-center p-8">
          <div className="text-white font-bold mb-2">MapKit Error</div>
          <div className="text-slate-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className={`flex items-center justify-center bg-slate-950 ${className}`}>
        <div className="text-center">
          <div className="text-white font-medium">Loading Apple Maps…</div>
          <div className="text-slate-400 text-sm mt-2">Initializing MapKit JS</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full min-h-[240px]" />
      <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-xs text-white">
        Apple Maps
      </div>
    </div>
  );
}
