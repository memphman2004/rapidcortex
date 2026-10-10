/** Merged into security AUDIT_EVENT_TYPES via packages/shared audit-schema. */
export const GIS_AUDIT_EVENT_TYPES = {
  GIS_DATASET_IMPORTED: "gis.dataset.imported",
  GIS_DATASET_APPROVED: "gis.dataset.approved",
  GIS_DATASET_REJECTED: "gis.dataset.rejected",
  GIS_DATASET_DISABLED: "gis.dataset.disabled",
  GIS_DISCOVER_QUERIED: "gis.discover.queried",
  GIS_SPATIAL_CONTEXT: "gis.spatial_context.queried",
} as const;

export type GisAuditEventTypeName =
  (typeof GIS_AUDIT_EVENT_TYPES)[keyof typeof GIS_AUDIT_EVENT_TYPES];
