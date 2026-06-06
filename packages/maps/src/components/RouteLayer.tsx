'use client';

import { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";

import { lineStringFeature } from "../utils/geojson-helpers";

export interface RouteLayerProps {
  map: mapboxgl.Map | null;
  /** [lng, lat][] in order */
  coordinates: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
  layerIdPrefix?: string;
}

export function RouteLayer({
  map,
  coordinates,
  color = "#3B82F6",
  width = 3,
  opacity = 0.75,
  layerIdPrefix,
}: RouteLayerProps) {
  const prefix = useMemo(() => {
    if (layerIdPrefix) return layerIdPrefix;
    return `rc-route-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2)}`;
  }, [layerIdPrefix]);
  const sourceId = `${prefix}-src`;
  const layerId = `${prefix}-line`;

  useEffect(() => {
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;
      if (coordinates.length < 2) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        return;
      }
      const data = lineStringFeature(coordinates);
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
      } else {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": color,
            "line-width": width,
            "line-opacity": opacity,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
        });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    return () => {
      map.off("load", apply);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [color, coordinates, layerId, map, opacity, prefix, sourceId, width]);

  return null;
}
