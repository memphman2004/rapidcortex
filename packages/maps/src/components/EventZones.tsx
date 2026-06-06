'use client';

import { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";

export interface EventZonesProps {
  map: mapboxgl.Map | null;
  zones: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  fillColor?: string;
  fillOpacity?: number;
  lineColor?: string;
  lineWidth?: number;
  layerIdPrefix?: string;
}

export function EventZones({
  map,
  zones,
  fillColor = "#6366f1",
  fillOpacity = 0.2,
  lineColor = "#a5b4fc",
  lineWidth = 2,
  layerIdPrefix,
}: EventZonesProps) {
  const prefix = useMemo(() => {
    if (layerIdPrefix) return layerIdPrefix;
    return `rc-zones-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2)}`;
  }, [layerIdPrefix]);
  const sourceId = `${prefix}-src`;
  const fillId = `${prefix}-fill`;
  const outlineId = `${prefix}-outline`;

  useEffect(() => {
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(zones);
      } else {
        map.addSource(sourceId, { type: "geojson", data: zones });
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": fillColor,
            "fill-opacity": fillOpacity,
          },
        });
        map.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": lineColor,
            "line-width": lineWidth,
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
  }, [
    fillColor,
    fillId,
    fillOpacity,
    lineColor,
    lineWidth,
    map,
    outlineId,
    prefix,
    sourceId,
    zones,
  ]);

  return null;
}
