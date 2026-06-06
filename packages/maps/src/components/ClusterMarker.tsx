'use client';

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

import type { SurgeSuggestedPriority } from "../types/map-types";

export interface ClusterMarkerProps {
  map: mapboxgl.Map | null;
  clusterId: string;
  latitude: number;
  longitude: number;
  callCount: number;
  incidentType: string;
  priority: SurgeSuggestedPriority;
  onClick?: (clusterId: string) => void;
}

const PRIORITY_COLORS: Record<SurgeSuggestedPriority, string> = {
  critical: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#6B7280",
};

const PRIORITY_ICONS: Record<SurgeSuggestedPriority, string> = {
  critical: "🚨",
  high: "⚠️",
  medium: "ℹ️",
  low: "📍",
};

export function ClusterMarker({
  map,
  clusterId,
  latitude,
  longitude,
  callCount,
  incidentType,
  priority,
  onClick,
}: ClusterMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!map) return;

    const mount = (): (() => void) => {
      markerRef.current?.remove();

      const el = document.createElement("div");
      el.className = "rc-cluster-marker";
      el.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: ${PRIORITY_COLORS[priority]};
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      font-weight: bold;
      color: white;
      transition: transform 0.2s;
    `;
      el.innerHTML = `
      <div style="font-size: 20px; line-height: 1;">${PRIORITY_ICONS[priority]}</div>
      <div style="font-size: 18px; line-height: 1; margin-top: 2px;">${callCount}</div>
    `;

      const onEnter = () => {
        el.style.transform = "scale(1.08)";
      };
      const onLeave = () => {
        el.style.transform = "scale(1)";
      };
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);

      const popup = new mapboxgl.Popup({ offset: 35 }).setHTML(`
      <div style="font-family: system-ui; padding: 12px; min-width: 200px; color: #111;">
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
          ${PRIORITY_ICONS[priority]} Surge cluster
        </div>
        <div style="font-size: 14px; margin-bottom: 4px;"><strong>Type:</strong> ${escapeHtml(incidentType)}</div>
        <div style="font-size: 14px; margin-bottom: 4px;"><strong>Calls:</strong> ${callCount}</div>
        <div style="font-size: 14px;"><strong>Priority:</strong> <span style="color: ${PRIORITY_COLORS[priority]}">${priority}</span></div>
      </div>
    `);

      const onElClick = () => clickRef.current?.(clusterId);
      el.addEventListener("click", onElClick);

      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map);

      return () => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("click", onElClick);
      };
    };

    let teardownEl: (() => void) | undefined;
    const run = () => {
      teardownEl?.();
      teardownEl = mount();
    };

    if (map.isStyleLoaded()) run();
    else map.once("load", run);

    return () => {
      map.off("load", run);
      teardownEl?.();
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [callCount, clusterId, incidentType, latitude, longitude, map, priority]);

  return null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
