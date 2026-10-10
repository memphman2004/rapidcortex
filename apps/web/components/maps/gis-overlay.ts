/**
 * GIS A1 GeoJSON overlays on RapidCortexMap — restored after ALS style switches.
 */
import type maplibregl from "maplibre-gl";

export const GIS_SOURCE_PREFIX = "rc-gis-src-";
export const GIS_FILL_PREFIX = "rc-gis-fill-";
export const GIS_LINE_PREFIX = "rc-gis-line-";
export const GIS_CIRCLE_PREFIX = "rc-gis-circle-";

export type GisOverlaySpec = {
  datasetId: string;
  name: string;
  color?: string;
  opacity?: number;
  featureCollection: GeoJSON.FeatureCollection;
};

function srcId(datasetId: string) {
  return `${GIS_SOURCE_PREFIX}${datasetId}`;
}
function fillId(datasetId: string) {
  return `${GIS_FILL_PREFIX}${datasetId}`;
}
function lineId(datasetId: string) {
  return `${GIS_LINE_PREFIX}${datasetId}`;
}
function circleId(datasetId: string) {
  return `${GIS_CIRCLE_PREFIX}${datasetId}`;
}

export function removeGisOverlay(map: maplibregl.Map, datasetId: string): void {
  for (const id of [fillId(datasetId), lineId(datasetId), circleId(datasetId)]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  const s = srcId(datasetId);
  if (map.getSource(s)) map.removeSource(s);
}

export function upsertGisOverlay(map: maplibregl.Map, spec: GisOverlaySpec): void {
  const color = spec.color ?? "#38bdf8";
  const opacity = spec.opacity ?? 0.35;
  const source = srcId(spec.datasetId);

  if (!map.getSource(source)) {
    map.addSource(source, { type: "geojson", data: spec.featureCollection });
  } else {
    (map.getSource(source) as maplibregl.GeoJSONSource).setData(spec.featureCollection);
  }

  if (!map.getLayer(fillId(spec.datasetId))) {
    map.addLayer({
      id: fillId(spec.datasetId),
      type: "fill",
      source,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": color,
        "fill-opacity": opacity,
      },
      metadata: {
        nexcort: {
          kind: "gis",
          datasetId: spec.datasetId,
          name: spec.name,
        },
      },
    });
  }

  if (!map.getLayer(lineId(spec.datasetId))) {
    map.addLayer({
      id: lineId(spec.datasetId),
      type: "line",
      source,
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "MultiLineString"],
        ["==", ["geometry-type"], "MultiPolygon"],
      ],
      paint: {
        "line-color": color,
        "line-width": 1.5,
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer(circleId(spec.datasetId))) {
    map.addLayer({
      id: circleId(spec.datasetId),
      type: "circle",
      source,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": color,
        "circle-radius": 5,
        "circle-opacity": 0.85,
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1,
      },
    });
  }
}

/** Re-apply all enabled GIS overlays after setStyle / style.load. */
export function restoreGisOverlays(map: maplibregl.Map, specs: GisOverlaySpec[]): void {
  for (const spec of specs) {
    upsertGisOverlay(map, spec);
  }
}

export function listGisLayerIds(datasetId: string): string[] {
  return [fillId(datasetId), lineId(datasetId), circleId(datasetId)];
}

/** HTML for a GIS feature popup (name + provenance). */
export function buildGisFeaturePopupHtml(opts: {
  datasetName: string;
  datasetId: string;
  properties?: Record<string, unknown> | null;
}): string {
  const props = opts.properties ?? {};
  const featureName =
    (typeof props.name === "string" && props.name) ||
    (typeof props.NAME === "string" && props.NAME) ||
    (typeof props.Name === "string" && props.Name) ||
    "Feature";
  const rows = Object.entries(props)
    .filter(([k]) => !["name", "NAME", "Name"].includes(k))
    .slice(0, 8)
    .map(
      ([k, v]) =>
        `<div style="display:flex;gap:8px;font-size:11px;margin-top:2px"><span style="color:#94a3b8">${escapeHtml(k)}</span><span style="color:#e2e8f0">${escapeHtml(String(v))}</span></div>`,
    )
    .join("");
  return `<div style="font-family:ui-sans-serif,system-ui;min-width:160px;max-width:260px">
    <div style="font-weight:700;font-size:12px;color:#0f172a">${escapeHtml(String(featureName))}</div>
    <div style="font-size:10px;color:#64748b;margin-top:2px">GIS · ${escapeHtml(opts.datasetName)}</div>
    <div style="font-size:10px;color:#94a3b8;margin-top:2px">dataset ${escapeHtml(opts.datasetId)}</div>
    ${rows}
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
