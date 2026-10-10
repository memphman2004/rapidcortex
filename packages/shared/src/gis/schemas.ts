import { z } from "zod";

export const gisApprovalStatusSchema = z.enum([
  "pending",
  "imported",
  "approved",
  "rejected",
  "disabled",
]);
export type GisApprovalStatus = z.infer<typeof gisApprovalStatusSchema>;

export const gisValidationStatusSchema = z.enum([
  "valid",
  "invalid",
  "unverified",
  "ai-inferred",
]);
export type GisValidationStatus = z.infer<typeof gisValidationStatusSchema>;

export const gisSourceTypeSchema = z.enum(["arcgis_featureserver", "geojson_url", "mock"]);
export type GisSourceType = z.infer<typeof gisSourceTypeSchema>;

export const gisGeometryTypeSchema = z.enum([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
  "unknown",
]);
export type GisGeometryType = z.infer<typeof gisGeometryTypeSchema>;

export const gisDiscoverQuerySchema = z.object({
  /** ArcGIS FeatureServer root or layer URL. */
  serviceUrl: z.string().url().max(2048).optional(),
  city: z.string().max(128).optional(),
  county: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  /** Bounding box: west,south,east,north */
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type GisDiscoverQuery = z.infer<typeof gisDiscoverQuerySchema>;

export const gisDatasetCandidateSchema = z.object({
  candidateId: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  sourceUrl: z.string().url().max(2048),
  sourceType: gisSourceTypeSchema,
  geometryType: gisGeometryTypeSchema.optional(),
  description: z.string().max(2000).optional(),
  license: z.string().max(512).optional(),
  coverageHint: z.string().max(512).optional(),
  featureCountEstimate: z.number().int().min(0).optional(),
  extent: z
    .object({
      xmin: z.number(),
      ymin: z.number(),
      xmax: z.number(),
      ymax: z.number(),
    })
    .optional(),
});
export type GisDatasetCandidate = z.infer<typeof gisDatasetCandidateSchema>;

export const gisImportBodySchema = z.object({
  sourceUrl: z.string().url().max(2048),
  sourceType: gisSourceTypeSchema.default("arcgis_featureserver"),
  name: z.string().min(1).max(256).optional(),
  /** Max features to import in A1 (hard cap). */
  maxFeatures: z.number().int().min(1).max(5000).optional().default(2000),
});
export type GisImportBody = z.infer<typeof gisImportBodySchema>;

export const gisApproveBodySchema = z.object({
  approved: z.boolean().default(true),
});
export type GisApproveBody = z.infer<typeof gisApproveBodySchema>;

export const gisLayerStyleSchema = z.object({
  color: z.string().max(32).optional(),
  opacity: z.number().min(0).max(1).optional(),
  defaultVisible: z.boolean().optional(),
});
export type GisLayerStyle = z.infer<typeof gisLayerStyleSchema>;

export const gisDatasetRecordSchema = z.object({
  datasetId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  sourceUrl: z.string().url().max(2048),
  sourceType: gisSourceTypeSchema,
  approvalStatus: gisApprovalStatusSchema,
  validationStatus: gisValidationStatusSchema,
  s3Key: z.string().max(1024).optional(),
  geometryType: gisGeometryTypeSchema.optional(),
  featureCount: z.number().int().min(0).optional(),
  license: z.string().max(512).optional(),
  layerStyle: gisLayerStyleSchema.optional(),
  syncEnabled: z.boolean().default(false),
  lastSyncAt: z.string().optional(),
  version: z.number().int().min(1).default(1),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().max(128).optional(),
  approvedBy: z.string().max(128).optional(),
  approvedAt: z.string().optional(),
});
export type GisDatasetRecord = z.infer<typeof gisDatasetRecordSchema>;

export const gisLayerSummarySchema = z.object({
  datasetId: z.string(),
  name: z.string(),
  geometryType: gisGeometryTypeSchema.optional(),
  featureCount: z.number().int().optional(),
  lastSyncAt: z.string().optional(),
  validationStatus: gisValidationStatusSchema,
  version: z.number().int(),
  layerStyle: gisLayerStyleSchema.optional(),
  /** Presigned or BFF-proxied GeoJSON URL for the ops map (short-lived). */
  geojsonUrl: z.string().url().optional(),
  sourceName: z.string().optional(),
});
export type GisLayerSummary = z.infer<typeof gisLayerSummarySchema>;

export const gisSpatialContextBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  datasetIds: z.array(z.string().max(128)).max(50).optional(),
});
export type GisSpatialContextBody = z.infer<typeof gisSpatialContextBodySchema>;

export const gisSpatialHitSchema = z.object({
  datasetId: z.string(),
  datasetName: z.string(),
  sourceUrl: z.string().optional(),
  version: z.number().int(),
  lastSyncAt: z.string().optional(),
  validationStatus: gisValidationStatusSchema,
  properties: z.record(z.unknown()).optional(),
});
export type GisSpatialHit = z.infer<typeof gisSpatialHitSchema>;

export const gisSpatialContextResponseSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  hits: z.array(gisSpatialHitSchema),
  queriedAt: z.string(),
});
export type GisSpatialContextResponse = z.infer<typeof gisSpatialContextResponseSchema>;

export function gisTenantPk(agencyId: string): string {
  return `TENANT#${agencyId.trim()}`;
}

export function gisDatasetSk(datasetId: string): string {
  return `DATASET#${datasetId.trim()}`;
}

export function gisS3Prefix(agencyId: string, datasetId: string): string {
  return `gis/${agencyId.trim()}/${datasetId.trim()}/`;
}
