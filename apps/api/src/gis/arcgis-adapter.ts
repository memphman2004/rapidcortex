import { createHash } from "node:crypto";
import type { GisDatasetCandidate, GisGeometryType } from "rapid-cortex-shared";
import { gisSafeFetch, SsrfBlockedError } from "./safe-fetch.js";

function mapEsriGeom(t: string | undefined): GisGeometryType {
  const v = (t ?? "").toLowerCase();
  if (v.includes("point")) return "Point";
  if (v.includes("polyline") || v.includes("line")) return "LineString";
  if (v.includes("polygon")) return "Polygon";
  return "unknown";
}

function layerUrl(serviceUrl: string, layerId: number): string {
  const base = serviceUrl.replace(/\/+$/, "").replace(/\/\d+$/, "");
  return `${base}/${layerId}`;
}

export function isGisMockMode(): boolean {
  const v = process.env.GIS_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function mockDiscoverCandidates(limit: number): GisDatasetCandidate[] {
  const candidates: GisDatasetCandidate[] = [
    {
      candidateId: "mock-uga-buildings",
      name: "Mock UGA Building Footprints",
      sourceUrl: "https://example.com/mock/FeatureServer/0",
      sourceType: "mock",
      geometryType: "Polygon",
      description: "Fixture dataset for GIS A1 (GIS_MOCK=1)",
      license: "mock",
      coverageHint: "Athens, GA (mock)",
      featureCountEstimate: 12,
      extent: { xmin: -83.4, ymin: 33.9, xmax: -83.3, ymax: 34.0 },
    },
  ];
  return candidates.slice(0, limit);
}

export async function discoverArcGisFeatureServer(
  serviceUrl: string,
  limit: number,
): Promise<GisDatasetCandidate[]> {
  if (isGisMockMode()) return mockDiscoverCandidates(limit);

  const metaUrl = `${serviceUrl.replace(/\/+$/, "")}?f=json`;
  const res = await gisSafeFetch(metaUrl);
  if (!res.ok) throw new Error(`ARCGIS_META_${res.status}`);
  const body = (await res.json()) as {
    layers?: Array<{
      id: number;
      name?: string;
      geometryType?: string;
      description?: string;
      extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
    }>;
    error?: { message?: string };
  };
  if (body.error) throw new Error(body.error.message ?? "ARCGIS_ERROR");

  const layers = body.layers ?? [];
  return layers.slice(0, limit).map((layer) => {
    const url = layerUrl(serviceUrl, layer.id);
    const candidateId = createHash("sha256").update(url).digest("hex").slice(0, 16);
    return {
      candidateId: `arcgis-${candidateId}`,
      name: layer.name?.trim() || `Layer ${layer.id}`,
      sourceUrl: url,
      sourceType: "arcgis_featureserver" as const,
      geometryType: mapEsriGeom(layer.geometryType),
      description: layer.description?.slice(0, 2000),
      extent: layer.extent
        ? {
            xmin: layer.extent.xmin,
            ymin: layer.extent.ymin,
            xmax: layer.extent.xmax,
            ymax: layer.extent.ymax,
          }
        : undefined,
    };
  });
}

export type NormalizedImport = {
  featureCollection: GeoJSON.FeatureCollection;
  geometryType: GisGeometryType;
  name: string;
};

function mockFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Mock Building A", source: "GIS_MOCK" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-83.375, 33.948],
              [-83.374, 33.948],
              [-83.374, 33.949],
              [-83.375, 33.949],
              [-83.375, 33.948],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Mock Building B", source: "GIS_MOCK" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-83.372, 33.946],
              [-83.371, 33.946],
              [-83.371, 33.947],
              [-83.372, 33.947],
              [-83.372, 33.946],
            ],
          ],
        },
      },
    ],
  };
}

export async function fetchArcGisLayerGeoJson(
  layerUrlRaw: string,
  maxFeatures: number,
): Promise<NormalizedImport> {
  if (isGisMockMode()) {
    const fc = mockFeatureCollection();
    return { featureCollection: fc, geometryType: "Polygon", name: "Mock UGA Building Footprints" };
  }

  const base = layerUrlRaw.replace(/\/+$/, "");
  const features: GeoJSON.Feature[] = [];
  let offset = 0;
  let name = "ArcGIS layer";
  let geometryType: GisGeometryType = "unknown";

  // Layer metadata for name/geometry
  try {
    const metaRes = await gisSafeFetch(`${base}?f=json`);
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { name?: string; geometryType?: string };
      if (meta.name) name = meta.name;
      geometryType = mapEsriGeom(meta.geometryType);
    }
  } catch {
    /* non-fatal */
  }

  while (features.length < maxFeatures) {
    const pageSize = Math.min(1000, maxFeatures - features.length);
    const q = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });
    const res = await gisSafeFetch(`${base}/query?${q.toString()}`);
    if (!res.ok) throw new Error(`ARCGIS_QUERY_${res.status}`);
    const body = (await res.json()) as GeoJSON.FeatureCollection & {
      exceededTransferLimit?: boolean;
      error?: { message?: string };
    };
    if ((body as { error?: { message?: string } }).error) {
      throw new Error((body as { error: { message: string } }).error.message);
    }
    const page = body.features ?? [];
    for (const f of page) {
      if (f && f.type === "Feature") features.push(f);
    }
    if (!body.exceededTransferLimit || page.length === 0) break;
    offset += page.length;
    if (offset > 50_000) break;
  }

  return {
    name,
    geometryType,
    featureCollection: { type: "FeatureCollection", features },
  };
}

export { SsrfBlockedError };
