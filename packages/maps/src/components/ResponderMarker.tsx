'use client';

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

export type ResponderType = "police" | "fire" | "ems" | "supervisor";

export interface ResponderMarkerProps {
  map: mapboxgl.Map | null;
  unitId: string;
  latitude: number;
  longitude: number;
  type: ResponderType;
  callsign: string;
  status: "available" | "enroute" | "onscene" | "unavailable";
  heading?: number;
}

const RESPONDER_ICONS: Record<ResponderType, string> = {
  police: "🚔",
  fire: "🚒",
  ems: "🚑",
  supervisor: "👮",
};

const STATUS_COLORS: Record<ResponderMarkerProps["status"], string> = {
  available: "#10B981",
  enroute: "#F59E0B",
  onscene: "#DC2626",
  unavailable: "#6B7280",
};

export function ResponderMarker({
  map,
  unitId,
  latitude,
  longitude,
  type,
  callsign,
  status,
  heading = 0,
}: ResponderMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const mount = () => {
      const el = document.createElement("div");
      el.className = "rc-responder-marker";
      el.style.cssText = `
      width: 45px;
      height: 45px;
      border-radius: 50%;
      background-color: ${STATUS_COLORS[status]};
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 24px;
      transform: rotate(${heading}deg);
    `;
      el.textContent = RESPONDER_ICONS[type];

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="font-family: system-ui; padding: 10px; color: #111;">
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px;">
          ${RESPONDER_ICONS[type]} ${escapeHtml(callsign)}
        </div>
        <div style="font-size: 13px;">
          <strong>Type:</strong> ${type.toUpperCase()}<br/>
          <strong>Status:</strong> <span style="color: ${STATUS_COLORS[status]}">${status}</span>
        </div>
      </div>
    `);

      const lngLat: [number, number] = [longitude, latitude];
      const next = new mapboxgl.Marker({ element: el, rotation: heading })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);
      markerRef.current?.remove();
      markerRef.current = next;
    };

    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);

    return () => {
      map.off("load", mount);
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [callsign, heading, latitude, longitude, map, status, type, unitId]);

  return null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
