'use client';

import { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";

import { emptyFeatureCollection } from "../utils/geojson-helpers";

export interface HeatMapProps {
  map: mapboxgl.Map | null;
  points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  layerIdPrefix?: string;
  intensity?: number;
  radius?: number;
  opacity?: number;
  colorRange?: [string, string, string];
}

export function HeatMap({
  map,
  points,
  layerIdPrefix,
  intensity = 1,
  radius = 18,
  opacity = 0.65,
  colorRange = ["#0ea5e9", "#f59e0b", "#dc2626"],
}: HeatMapProps) {
  const prefix = useMemo(() => {
    if (layerIdPrefix) return layerIdPrefix;
    return `rc-heat-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2)}`;
  }, [layerIdPrefix]);
  const sourceId = `${prefix}-src`;
  const layerId = `${prefix}-heat`;

  useEffect(() => {
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const data = points.features.length ? points : emptyFeatureCollection();
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
      } else {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: layerId,
          type: "heatmap",
          source: sourceId,
          paint: {
            "heatmap-intensity": intensity,
            "heatmap-radius": radius,
            "heatmap-opacity": opacity,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              colorRange[0],
              0.4,
              colorRange[1],
              1,
              colorRange[2],
            ],
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
  }, [colorRange, intensity, layerId, map, opacity, points, prefix, radius, sourceId]);

  return null;
}
