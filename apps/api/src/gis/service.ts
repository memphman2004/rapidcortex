import { randomUUID } from "node:crypto";
import {
  type GisDatasetCandidate,
  type GisDatasetRecord,
  type GisDiscoverQuery,
  type GisImportBody,
  type GisLayerSummary,
  type GisSpatialContextBody,
  type GisSpatialContextResponse,
  type UserContext,
} from "rapid-cortex-shared";
import { discoverArcGisFeatureServer, fetchArcGisLayerGeoJson, isGisMockMode } from "./arcgis-adapter.js";
import { GisDatasetsRepository } from "./repository.js";
import { getNormalizedGeoJson, presignNormalizedGeoJson, putNormalizedGeoJson } from "./storage.js";
import { findContainingFeatures } from "./spatial.js";

const repo = new GisDatasetsRepository();

function requireAgency(user: UserContext): string {
  const agencyId = user.agencyId?.trim();
  if (!agencyId) throw new Error("AGENCY_REQUIRED");
  return agencyId;
}

export async function discoverGis(
  user: UserContext,
  query: GisDiscoverQuery,
): Promise<{ candidates: GisDatasetCandidate[] }> {
  const limit = query.limit ?? 20;
  if (query.serviceUrl?.trim()) {
    const candidates = await discoverArcGisFeatureServer(query.serviceUrl.trim(), limit);
    return { candidates };
  }
  if (isGisMockMode()) {
    const { mockDiscoverCandidates } = await import("./arcgis-adapter.js");
    return { candidates: mockDiscoverCandidates(limit) };
  }
  // A1 without serviceUrl: return empty (admin must paste FeatureServer URL).
  return { candidates: [] };
}

export async function importGisDataset(
  user: UserContext,
  body: GisImportBody,
): Promise<GisDatasetRecord> {
  const agencyId = requireAgency(user);
  const imported = await fetchArcGisLayerGeoJson(body.sourceUrl, body.maxFeatures ?? 2000);
  const datasetId = randomUUID().replace(/-/g, "").slice(0, 16);
  const now = new Date().toISOString();
  const s3Key = await putNormalizedGeoJson(agencyId, datasetId, imported.featureCollection);
  const record: GisDatasetRecord = {
    datasetId,
    agencyId,
    name: body.name?.trim() || imported.name,
    sourceUrl: body.sourceUrl,
    sourceType: isGisMockMode() ? "mock" : body.sourceType,
    approvalStatus: "imported",
    validationStatus: "unverified",
    s3Key,
    geometryType: imported.geometryType,
    featureCount: imported.featureCollection.features.length,
    syncEnabled: false,
    version: 1,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    createdBy: user.userId,
    lastSyncAt: now,
    layerStyle: { color: "#38bdf8", opacity: 0.35, defaultVisible: false },
  };
  await repo.put(record);
  return record;
}

export async function approveGisDataset(
  user: UserContext,
  datasetId: string,
  approved: boolean,
): Promise<GisDatasetRecord> {
  const agencyId = requireAgency(user);
  const existing = await repo.get(agencyId, datasetId);
  if (!existing) throw new Error("NOT_FOUND");
  const now = new Date().toISOString();
  const updated = await repo.updateApproval(agencyId, datasetId, {
    approvalStatus: approved ? "approved" : "rejected",
    validationStatus: approved ? "valid" : existing.validationStatus,
    approvedBy: user.userId,
    approvedAt: now,
    enabled: approved,
    updatedAt: now,
  });
  if (!updated) throw new Error("NOT_FOUND");
  return updated;
}

export async function listGisLayers(user: UserContext): Promise<GisLayerSummary[]> {
  const agencyId = requireAgency(user);
  const rows = await repo.listByAgency(agencyId);
  const approved = rows.filter((r) => r.approvalStatus === "approved" && r.enabled !== false);
  const out: GisLayerSummary[] = [];
  for (const r of approved) {
    let geojsonUrl: string | undefined;
    try {
      geojsonUrl = await presignNormalizedGeoJson(agencyId, r.datasetId);
    } catch {
      geojsonUrl = undefined;
    }
    out.push({
      datasetId: r.datasetId,
      name: r.name,
      geometryType: r.geometryType,
      featureCount: r.featureCount,
      lastSyncAt: r.lastSyncAt,
      validationStatus: r.validationStatus,
      version: r.version,
      layerStyle: r.layerStyle,
      geojsonUrl,
      sourceName: r.sourceUrl,
    });
  }
  return out;
}

export async function listGisDatasets(user: UserContext): Promise<GisDatasetRecord[]> {
  const agencyId = requireAgency(user);
  return repo.listByAgency(agencyId);
}

export async function getGisDatasetGeoJson(
  user: UserContext,
  datasetId: string,
): Promise<GeoJSON.FeatureCollection | null> {
  const agencyId = requireAgency(user);
  const row = await repo.get(agencyId, datasetId);
  if (!row) return null;
  return getNormalizedGeoJson(agencyId, datasetId);
}

export async function spatialContext(
  user: UserContext,
  body: GisSpatialContextBody,
): Promise<GisSpatialContextResponse> {
  const agencyId = requireAgency(user);
  const rows = await repo.listByAgency(agencyId);
  let approved = rows.filter((r) => r.approvalStatus === "approved" && r.enabled !== false);
  if (body.datasetIds?.length) {
    const allow = new Set(body.datasetIds);
    approved = approved.filter((r) => allow.has(r.datasetId));
  }
  const hits: GisSpatialContextResponse["hits"] = [];
  for (const r of approved) {
    const fc = await getNormalizedGeoJson(agencyId, r.datasetId);
    if (!fc) continue;
    const containing = findContainingFeatures(fc, body.lng, body.lat, 5);
    for (const f of containing) {
      hits.push({
        datasetId: r.datasetId,
        datasetName: r.name,
        sourceUrl: r.sourceUrl,
        version: r.version,
        lastSyncAt: r.lastSyncAt,
        validationStatus: r.validationStatus,
        properties: (f.properties ?? undefined) as Record<string, unknown> | undefined,
      });
    }
  }
  return {
    lat: body.lat,
    lng: body.lng,
    hits,
    queriedAt: new Date().toISOString(),
  };
}
