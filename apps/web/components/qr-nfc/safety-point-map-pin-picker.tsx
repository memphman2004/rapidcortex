"use client";

/**
 * Interactive ALS / MapLibre pin for QR/NFC registered installation coordinates.
 * Drag or click to set the pin. Never marks VERIFIED — parent must call verify explicitly.
 */
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RapidCortexMap } from "rapid-cortex-maps";

export type SafetyPointMapPinPickerProps = {
  latitude?: number;
  longitude?: number;
  onChange: (next: { latitude: number; longitude: number; coordinateSource: "MAP_PIN" }) => void;
  height?: number;
  accent?: string;
  disabled?: boolean;
};

function isFiniteCoord(lat?: number, lng?: number): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function SafetyPointMapPinPicker({
  latitude,
  longitude,
  onChange,
  height = 240,
  accent = "#38bdf8",
  disabled = false,
}: SafetyPointMapPinPickerProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hasPin = isFiniteCoord(latitude, longitude);
  const center: [number, number] = hasPin ? [longitude, latitude] : [-98.5795, 39.8283];

  useEffect(() => {
    if (!map || disabled) return;

    const ensureMarker = (lng: number, lat: number) => {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
        return;
      }
      const el = document.createElement("div");
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${accent};
        border: 2px solid #0f172a;
        box-shadow: 0 0 0 2px ${accent}55;
        cursor: grab;
      `;
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng: nextLng, lat: nextLat } = marker.getLngLat();
        onChangeRef.current({
          latitude: nextLat,
          longitude: nextLng,
          coordinateSource: "MAP_PIN",
        });
      });
      markerRef.current = marker;
    };

    if (hasPin) {
      ensureMarker(longitude, latitude);
      map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 16), duration: 400 });
    }

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (disabled) return;
      const { lng, lat } = e.lngLat;
      ensureMarker(lng, lat);
      onChangeRef.current({
        latitude: lat,
        longitude: lng,
        coordinateSource: "MAP_PIN",
      });
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, hasPin, latitude, longitude, accent, disabled]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded border border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950/80 px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400">
          INSTALLATION MAP PIN
        </span>
        <span className="text-[10px] text-slate-500">
          {disabled ? "Read only" : "Click map or drag pin · stays UNVERIFIED until confirmed"}
        </span>
      </div>
      <div style={{ height, position: "relative" }}>
        <RapidCortexMap
          center={center}
          zoom={hasPin ? 17 : 4}
          theme="dark"
          showControls
          onMapLoad={setMap}
        />
      </div>
      {hasPin ? (
        <p className="border-t border-slate-700 bg-slate-950/60 px-3 py-1.5 font-mono text-[11px] text-slate-400">
          {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
        </p>
      ) : (
        <p className="border-t border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[11px] text-amber-200/80">
          No pin yet — click the map to place the installation marker.
        </p>
      )}
    </div>
  );
}
