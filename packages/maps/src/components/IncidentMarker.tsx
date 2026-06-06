'use client';

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

export interface IncidentMarkerProps {
  map: mapboxgl.Map | null;
  incidentId: string;
  latitude: number;
  longitude: number;
  label?: string;
  subtitle?: string;
}

export function IncidentMarker({
  map,
  incidentId,
  latitude,
  longitude,
  label = "Incident",
  subtitle,
}: IncidentMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const mount = () => {
      const el = document.createElement("div");
      el.className = "rc-incident-marker";
      el.style.cssText = `
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(145deg,#f97316,#ea580c);
      border: 3px solid white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-weight:800;
      font-size:16px;
      font-family: system-ui,sans-serif;
      cursor:pointer;
    `;
      el.textContent = "i";

      const popup = new mapboxgl.Popup({ offset: 28 }).setHTML(`
      <div style="font-family:system-ui,sans-serif;padding:8px;color:#111;min-width:160px;">
        <div style="font-weight:700;">${escapeHtml(label)}</div>
        ${
          subtitle
            ? `<div style="font-size:12px;color:#555;margin-top:4px">${escapeHtml(subtitle)}</div>`
            : ""
        }
        <div style="font-size:11px;color:#888;margin-top:6px">${escapeHtml(incidentId)}</div>
      </div>
    `);

      const next = new mapboxgl.Marker({ element: el })
        .setLngLat([longitude, latitude])
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
  }, [incidentId, label, latitude, longitude, map, subtitle]);

  return null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
