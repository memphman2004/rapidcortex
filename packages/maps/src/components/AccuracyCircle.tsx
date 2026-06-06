'use client';

import { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";

import type { LocationConfidence } from "../types/map-types";
import { createAccuracyCirclePolygon } from "../utils/geojson-helpers";

export interface AccuracyCircleProps {
  map: mapboxgl.Map | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  confidence: LocationConfidence;
  /** Unique per overlay instance (default: random). */
  layerIdPrefix?: string;
}

const COLORS: Record<LocationConfidence, string> = {
  high: "#10B981",
  medium: "#F59E0B",
  low: "#DC2626",
};

export function AccuracyCircle({
  map,
  latitude,
  longitude,
  radiusMeters,
  confidence,
  layerIdPrefix,
}: AccuracyCircleProps) {
  const prefix = useMemo(() => {
    if (layerIdPrefix) return layerIdPrefix;
    return `rc-acc-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2)}`;
  }, [layerIdPrefix]);

  const sourceId = `${prefix}-src`;
  const fillId = `${prefix}-fill`;
  const outlineId = `${prefix}-outline`;

  useEffect(() => {
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const data = createAccuracyCirclePolygon(latitude, longitude, radiusMeters);
      const color = COLORS[confidence];
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
        if (map.getLayer(fillId))
          map.setPaintProperty(fillId, "fill-color", color);
        if (map.getLayer(outlineId))
          map.setPaintProperty(outlineId, "line-color", color);
      } else {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: { "fill-color": color, "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": color,
            "line-width": 2,
            "line-opacity": 0.75,
          },
        });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    return () => {
      map.off("load", apply);
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(outlineId)) map.removeLayer(outlineId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [confidence, fillId, latitude, longitude, map, outlineId, prefix, radiusMeters, sourceId]);

  return null;
}
