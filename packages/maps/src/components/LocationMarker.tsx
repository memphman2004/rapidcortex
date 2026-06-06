'use client';

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";

import type { LocationConfidence } from "../types/map-types";
import { createAccuracyCirclePolygon } from "../utils/geojson-helpers";

export interface LocationMarkerProps {
  map: mapboxgl.Map | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  confidence: LocationConfidence;
  heading?: number;
  speed?: number;
  label?: string;
}

const CONFIDENCE_COLORS: Record<LocationConfidence, string> = {
  high: "#10B981",
  medium: "#F59E0B",
  low: "#DC2626",
};

function removeAccuracyLayers(map: mapboxgl.Map, fillId: string, outlineId: string, sourceId: string) {
  if (map.getLayer(fillId)) map.removeLayer(fillId);
  if (map.getLayer(outlineId)) map.removeLayer(outlineId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function removeLayerSource(map: mapboxgl.Map, layerId: string, sourceId: string) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export function LocationMarker({
  map,
  latitude,
  longitude,
  accuracy,
  confidence,
  heading,
  speed,
  label = "Caller",
}: LocationMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const instancePrefix = useMemo(
    () => `rc-lm-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2)}`,
    [],
  );
  const sourceId = `${instancePrefix}-accuracy`;
  const fillId = `${instancePrefix}-accuracy-fill`;
  const outlineId = `${instancePrefix}-accuracy-outline`;
  const movementSourceId = `${instancePrefix}-movement`;
  const movementLayerId = `${instancePrefix}-movement-line`;

  useEffect(() => {
    if (!map) return;

    const lngLat: [number, number] = [longitude, latitude];

    const popupHtml = `
      <div style="font-family: system-ui, sans-serif; padding: 8px; color: #111;">
        <strong>${label}</strong><br/>
        <small>
          Accuracy: ±${Math.round(accuracy)} m<br/>
          Confidence: ${confidence}<br/>
          ${speed != null && speed > 0.1 ? `Speed: ${(speed * 2.23694).toFixed(1)} mph<br/>` : ""}
          ${heading != null ? `Heading: ${Math.round(heading)}°` : ""}
        </small>
      </div>`;
    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml);

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "rc-location-marker";
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = CONFIDENCE_COLORS[confidence];
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      markerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(lngLat).setPopup(popup).addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
      const node = markerRef.current.getElement();
      if (node) node.style.backgroundColor = CONFIDENCE_COLORS[confidence];
    }

    const attachAccuracy = () => {
      if (!map.isStyleLoaded()) return;
      const circleData = createAccuracyCirclePolygon(latitude, longitude, accuracy);
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(circleData);
      } else {
        map.addSource(sourceId, { type: "geojson", data: circleData });
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": CONFIDENCE_COLORS[confidence],
            "fill-opacity": 0.15,
          },
        });
        map.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": CONFIDENCE_COLORS[confidence],
            "line-width": 2,
            "line-opacity": 0.8,
          },
        });
      }
    };

    const attachMovement = () => {
      if (!map.isStyleLoaded()) return;
      if (heading == null || speed == null || speed <= 1) {
        removeLayerSource(map, movementLayerId, movementSourceId);
        return;
      }
      const speedMph = speed * 2.23694;
      const vectorLength = Math.min(speedMph * 20, 200);
      const lat = latitude;
      const lon = longitude;
      const endLat = lat + (vectorLength / 111_000) * Math.cos((heading * Math.PI) / 180);
      const endLon = lon + (vectorLength / (111_000 * Math.cos((lat * Math.PI) / 180))) * Math.sin((heading * Math.PI) / 180);

      const line: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [[lon, lat], [endLon, endLat]],
        },
      };

      if (map.getSource(movementSourceId)) {
        (map.getSource(movementSourceId) as mapboxgl.GeoJSONSource).setData(line);
      } else {
        map.addSource(movementSourceId, {
          type: "geojson",
          data: line,
        });
        map.addLayer({
          id: movementLayerId,
          type: "line",
          source: movementSourceId,
          paint: {
            "line-color": "#DC2626",
            "line-width": 4,
            "line-opacity": 0.9,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
    };

    const run = () => {
      attachAccuracy();
      attachMovement();
    };

    if (!map.isStyleLoaded()) {
      map.once("load", run);
      return () => {
        map.off("load", run);
        markerRef.current?.remove();
        markerRef.current = null;
        removeAccuracyLayers(map, fillId, outlineId, sourceId);
        removeLayerSource(map, movementLayerId, movementSourceId);
      };
    }

    run();

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      removeAccuracyLayers(map, fillId, outlineId, sourceId);
      removeLayerSource(map, movementLayerId, movementSourceId);
    };
  }, [accuracy, confidence, heading, label, latitude, longitude, map, speed, sourceId, fillId, outlineId, movementSourceId, movementLayerId]);

  return null;
}
