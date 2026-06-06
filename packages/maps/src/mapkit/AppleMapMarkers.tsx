'use client';

import { useEffect, useRef } from "react";

import type { LocationConfidence } from "../types/map-types";
import type { MapKitMapInstance } from "./types";

export interface AppleLocationMarkerProps {
  map: MapKitMapInstance;
  latitude: number;
  longitude: number;
  accuracy: number;
  confidence: LocationConfidence;
  title?: string;
}

export function AppleLocationMarker({
  map,
  latitude,
  longitude,
  accuracy,
  confidence,
  title = "Caller Location",
}: AppleLocationMarkerProps) {
  const markerRef = useRef<mapkit.MarkerAnnotation | null>(null);
  const overlayRef = useRef<mapkit.CircleOverlay | null>(null);

  useEffect(() => {
    if (!map || !window.mapkit) return;

    if (markerRef.current) map.removeAnnotation(markerRef.current);
    if (overlayRef.current) map.removeOverlay(overlayRef.current);

    const color =
      confidence === "high" ? "#10B981" : confidence === "medium" ? "#F59E0B" : "#DC2626";
    const coordinate = new window.mapkit.Coordinate(latitude, longitude);

    const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
      color,
      title,
      subtitle: `Accuracy: ±${Math.round(accuracy)}m`,
      glyphText: "📍",
    });
    map.addAnnotation(annotation);
    markerRef.current = annotation;

    const circle = new window.mapkit.CircleOverlay(coordinate, accuracy, {
      strokeColor: color,
      strokeOpacity: 0.8,
      lineWidth: 2,
      fillColor: color,
      fillOpacity: 0.15,
    });
    map.addOverlay(circle);
    overlayRef.current = circle;

    return () => {
      if (markerRef.current) map.removeAnnotation(markerRef.current);
      if (overlayRef.current) map.removeOverlay(overlayRef.current);
    };
  }, [map, latitude, longitude, accuracy, confidence, title]);

  return null;
}

export type AppleClusterPriority = "critical" | "high" | "medium" | "low";

export interface AppleClusterMarkerProps {
  map: MapKitMapInstance;
  clusterId: string;
  latitude: number;
  longitude: number;
  callCount: number;
  incidentType: string;
  priority: AppleClusterPriority;
  onClick?: (clusterId: string) => void;
}

export function AppleClusterMarker({
  map,
  clusterId,
  latitude,
  longitude,
  callCount,
  incidentType,
  priority,
  onClick,
}: AppleClusterMarkerProps) {
  const markerRef = useRef<mapkit.MarkerAnnotation | null>(null);

  useEffect(() => {
    if (!map || !window.mapkit) return;
    if (markerRef.current) map.removeAnnotation(markerRef.current);

    const priorityColors: Record<AppleClusterPriority, string> = {
      critical: "#DC2626",
      high: "#F59E0B",
      medium: "#3B82F6",
      low: "#6B7280",
    };
    const priorityIcons: Record<AppleClusterPriority, string> = {
      critical: "🚨",
      high: "⚠️",
      medium: "ℹ️",
      low: "📍",
    };

    const coordinate = new window.mapkit.Coordinate(latitude, longitude);
    const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
      color: priorityColors[priority],
      title: `${priorityIcons[priority]} ${incidentType}`,
      subtitle: `${callCount} calls`,
      glyphText: String(callCount),
    });

    if (onClick) {
      annotation.addEventListener("select", () => onClick(clusterId));
    }

    map.addAnnotation(annotation);
    markerRef.current = annotation;

    return () => {
      if (markerRef.current) map.removeAnnotation(markerRef.current);
    };
  }, [map, clusterId, latitude, longitude, callCount, incidentType, priority, onClick]);

  return null;
}

export type AppleResponderType = "police" | "fire" | "ems" | "supervisor";
export type AppleResponderStatus = "available" | "enroute" | "onscene" | "unavailable";

export interface AppleResponderMarkerProps {
  map: MapKitMapInstance;
  unitId: string;
  latitude: number;
  longitude: number;
  type: AppleResponderType;
  callsign: string;
  status: AppleResponderStatus;
}

export function AppleResponderMarker({
  map,
  unitId,
  latitude,
  longitude,
  type,
  callsign,
  status,
}: AppleResponderMarkerProps) {
  const markerRef = useRef<mapkit.MarkerAnnotation | null>(null);

  useEffect(() => {
    if (!map || !window.mapkit) return;
    if (markerRef.current) map.removeAnnotation(markerRef.current);

    const icons: Record<AppleResponderType, string> = {
      police: "🚔",
      fire: "🚒",
      ems: "🚑",
      supervisor: "👮",
    };
    const statusColors: Record<AppleResponderStatus, string> = {
      available: "#10B981",
      enroute: "#F59E0B",
      onscene: "#DC2626",
      unavailable: "#6B7280",
    };

    const coordinate = new window.mapkit.Coordinate(latitude, longitude);
    const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
      color: statusColors[status],
      title: `${icons[type]} ${callsign}`,
      subtitle: status.toUpperCase(),
      glyphText: icons[type],
    });

    map.addAnnotation(annotation);
    markerRef.current = annotation;

    return () => {
      if (markerRef.current) map.removeAnnotation(markerRef.current);
    };
  }, [map, unitId, latitude, longitude, type, callsign, status]);

  return null;
}
