import type {
  GisDatasetCandidate,
  GisDatasetRecord,
  GisLayerSummary,
  GisSpatialContextResponse,
} from "rapid-cortex-shared";

async function gisFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    let message = `GIS request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function discoverGis(serviceUrl?: string) {
  const qs = serviceUrl
    ? `?serviceUrl=${encodeURIComponent(serviceUrl)}`
    : "";
  return gisFetch<{ candidates: GisDatasetCandidate[] }>(`/api/gis/discover${qs}`);
}

export function listGisDatasets() {
  return gisFetch<{ items: GisDatasetRecord[] }>("/api/gis/datasets");
}

export function importGisDataset(body: {
  sourceUrl: string;
  sourceType?: "arcgis_featureserver" | "geojson_url" | "mock";
  name?: string;
  maxFeatures?: number;
}) {
  return gisFetch<{ dataset: GisDatasetRecord }>("/api/gis/datasets/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function approveGisDataset(datasetId: string, approved = true) {
  return gisFetch<{ dataset: GisDatasetRecord }>(
    `/api/gis/datasets/${encodeURIComponent(datasetId)}/approve`,
    { method: "POST", body: JSON.stringify({ approved }) },
  );
}

export function listGisLayers() {
  return gisFetch<{ layers: GisLayerSummary[] }>("/api/gis/layers");
}

export function fetchGisDatasetGeoJson(datasetId: string) {
  return gisFetch<GeoJSON.FeatureCollection>(
    `/api/gis/datasets/${encodeURIComponent(datasetId)}/geojson`,
  );
}

export function queryGisSpatialContext(lat: number, lng: number, datasetIds?: string[]) {
  return gisFetch<GisSpatialContextResponse>("/api/gis/spatial-context", {
    method: "POST",
    body: JSON.stringify({ lat, lng, datasetIds }),
  });
}
