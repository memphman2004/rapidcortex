import type maplibregl from "maplibre-gl";
import type { RCMapLayerVisibility } from "./map-types";
import {
  EMPTY_OVERLAY_FC as EMPTY_FC,
  OVERLAY_AIRPORTS_CIRCLE,
  OVERLAY_AIRPORTS_LABEL,
  OVERLAY_AIRPORTS_SOURCE,
  OVERLAY_COUNTIES_LINE,
  OVERLAY_COUNTIES_SOURCE,
  OVERLAY_STATES_LINE,
  OVERLAY_STATES_SOURCE,
  OVERLAY_ZONES_FILL,
  OVERLAY_ZONES_LINE,
  OVERLAY_ZONES_SOURCE,
  overlayZonesEnabled,
} from "./runtime-overlays";

function safeSetVisibility(map: maplibregl.Map, layerId: string, visible: boolean): void {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function firstSymbolFont(map: maplibregl.Map): string[] {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const font = (layer.layout as { "text-font"?: string[] } | undefined)?.["text-font"];
    if (Array.isArray(font) && font.length > 0) return font;
  }
  return ["Noto Sans Regular"];
}

function ensureSource(map: maplibregl.Map, id: string): void {
  if (map.getSource(id)) return;
  map.addSource(id, { type: "geojson", data: EMPTY_FC });
}

export function ensureRuntimeOverlayLayers(map: maplibregl.Map): void {
  ensureSource(map, OVERLAY_STATES_SOURCE);
  ensureSource(map, OVERLAY_COUNTIES_SOURCE);
  ensureSource(map, OVERLAY_AIRPORTS_SOURCE);
  ensureSource(map, OVERLAY_ZONES_SOURCE);

  if (!map.getLayer(OVERLAY_ZONES_FILL)) {
    map.addLayer({
      id: OVERLAY_ZONES_FILL,
      type: "fill",
      source: OVERLAY_ZONES_SOURCE,
      paint: {
        "fill-color": "#3b82f6",
        "fill-opacity": 0.12,
      },
    });
  }
  if (!map.getLayer(OVERLAY_ZONES_LINE)) {
    map.addLayer({
      id: OVERLAY_ZONES_LINE,
      type: "line",
      source: OVERLAY_ZONES_SOURCE,
      paint: {
        "line-color": "#60a5fa",
        "line-width": 2,
        "line-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(OVERLAY_COUNTIES_LINE)) {
    map.addLayer({
      id: OVERLAY_COUNTIES_LINE,
      type: "line",
      source: OVERLAY_COUNTIES_SOURCE,
      paint: {
        "line-color": "#94a3b8",
        "line-width": 0.6,
        "line-opacity": 0.55,
      },
    });
  }
  if (!map.getLayer(OVERLAY_STATES_LINE)) {
    map.addLayer({
      id: OVERLAY_STATES_LINE,
      type: "line",
      source: OVERLAY_STATES_SOURCE,
      paint: {
        "line-color": "#cbd5e1",
        "line-width": 1.4,
        "line-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer(OVERLAY_AIRPORTS_CIRCLE)) {
    map.addLayer({
      id: OVERLAY_AIRPORTS_CIRCLE,
      type: "circle",
      source: OVERLAY_AIRPORTS_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 6],
        "circle-color": "#f59e0b",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0f1117",
        "circle-opacity": 0.92,
      },
    });
  }
  if (!map.getLayer(OVERLAY_AIRPORTS_LABEL)) {
    try {
      map.addLayer({
        id: OVERLAY_AIRPORTS_LABEL,
        type: "symbol",
        source: OVERLAY_AIRPORTS_SOURCE,
        minzoom: 6,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-font": firstSymbolFont(map),
          "text-optional": true,
        },
        paint: {
          "text-color": "#fbbf24",
          "text-halo-color": "#0f1117",
          "text-halo-width": 1.2,
        },
      });
    } catch {
      /* glyph set in the ALS style may not include the chosen font */
    }
  }
}

export function applyRuntimeOverlayVisibility(
  map: maplibregl.Map,
  layers: RCMapLayerVisibility,
): void {
  safeSetVisibility(map, OVERLAY_STATES_LINE, layers.stateBoundaries);
  safeSetVisibility(map, OVERLAY_COUNTIES_LINE, layers.counties);
  safeSetVisibility(map, OVERLAY_AIRPORTS_CIRCLE, layers.airports);
  safeSetVisibility(map, OVERLAY_AIRPORTS_LABEL, layers.airports);
  const zones = overlayZonesEnabled(layers);
  safeSetVisibility(map, OVERLAY_ZONES_FILL, zones);
  safeSetVisibility(map, OVERLAY_ZONES_LINE, zones);
}

export function setOverlaySourceData(
  map: maplibregl.Map,
  sourceId: string,
  data: GeoJSON.FeatureCollection,
): void {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

export function applyTrafficLayerVisibility(
  map: maplibregl.Map,
  flowIds: string[],
  closureIds: string[],
  layers: RCMapLayerVisibility,
): void {
  for (const id of flowIds) safeSetVisibility(map, id, layers.liveTraffic);
  for (const id of closureIds) safeSetVisibility(map, id, layers.liveTrafficClosures);
}
