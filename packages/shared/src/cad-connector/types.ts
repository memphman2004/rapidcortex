/**
 * Rapid Cortex — Multi-CAD Connector System: canonical shared types.
 * All vendor adapters normalize to/from these types.
 * Addon: `cad.connector` — requireAddon("cad.connector") at every API handler.
 */

// ─── Vendor IDs ─────────────────────────────────────────────────────────────

export const CAD_VENDOR_IDS = [
  "motorola_premierone",
  "tyler_new_world",
  "hexagon_intergraph",
  "central_square",
  "spillman",
  "generic_rest",
] as const;

export type CadVendorId = (typeof CAD_VENDOR_IDS)[number];

export const CAD_DEPARTMENT_TYPES = [
  "law_enforcement",
  "fire",
  "ems",
  "combined_fire_ems",
  "emergency_management",
  "combined_all",
] as const;

export type CadDepartmentType = (typeof CAD_DEPARTMENT_TYPES)[number];

export const CAD_CONNECTION_MODES = ["polling", "webhook", "streaming"] as const;
export type CadConnectionMode = (typeof CAD_CONNECTION_MODES)[number];

export const CAD_AUTH_TYPES = ["api_key", "basic", "oauth2", "mtls"] as const;
export type CadAuthType = (typeof CAD_AUTH_TYPES)[number];

export interface CadConnectorCredentials {
  authType: CadAuthType;
  /** Secrets Manager ARN — never plaintext in DynamoDB or API responses. */
  secretArn: string;
}

export interface CadConnectorConfig {
  connectorId: string;
  agencyId: string;
  vendorId: CadVendorId;
  displayName: string;
  department: CadDepartmentType;
  enabled: boolean;
  connectionMode: CadConnectionMode;
  pollingIntervalSeconds?: number;
  /** Present in Lambda after KMS decrypt; never returned to the browser. */
  baseUrl?: string;
  credentials: CadConnectorCredentials;
  fieldMappings: CadFieldMapping[];
  routingRules: CadRoutingRule[];
  lastHealthCheck?: CadHealthCheckResult;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  /** Soft-delete timestamp; hidden from list after set. */
  deletedAt?: string;
}

export interface CadFieldMapping {
  mappingId: string;
  vendorField: string;
  rcField: string;
  transform?: CadFieldTransform;
  required: boolean;
  direction: "inbound" | "outbound" | "both";
}

export type CadFieldTransform =
  | { type: "uppercase" }
  | { type: "lowercase" }
  | { type: "trim" }
  | { type: "date_iso"; sourceFormat: string }
  | { type: "code_lookup"; table: Record<string, string> }
  | { type: "static_value"; value: string | number | boolean }
  | { type: "regex_extract"; pattern: string; group: number };

export interface CadRoutingRule {
  ruleId: string;
  priority: number;
  description: string;
  conditions: CadRoutingCondition[];
  targetConnectorId: string;
  requireSupervisorApproval: boolean;
  enabled: boolean;
}

export type CadRoutingCondition =
  | { field: "department"; operator: "eq"; value: CadDepartmentType }
  | { field: "incidentType"; operator: "eq" | "in"; value: string | string[] }
  | { field: "zone"; operator: "eq" | "in"; value: string | string[] }
  | { field: "priority"; operator: "gte" | "lte" | "eq"; value: number }
  | { field: "callerLocation"; operator: "within_zone"; zoneId: string };

export const UNIFIED_CAD_STATUSES = [
  "pending",
  "queued",
  "dispatched",
  "en_route",
  "on_scene",
  "cleared",
  "cancelled",
  "duplicate",
  "unknown",
] as const;

export type UnifiedCadStatus = (typeof UNIFIED_CAD_STATUSES)[number];

export interface UnifiedCadUnit {
  unitId: string;
  callSign: string;
  status: string;
  department?: CadDepartmentType;
  latitude?: number;
  longitude?: number;
  assignedAt?: string;
}

export interface UnifiedCadIncident {
  unifiedId: string;
  agencyId: string;
  connectorId: string;
  vendorId: CadVendorId;
  department: CadDepartmentType;
  vendorIncidentId: string;
  vendorCallId?: string;
  cadIncidentNumber?: string;
  incidentType: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: UnifiedCadStatus;
  nature?: string;
  address?: string;
  addressVerified?: boolean;
  latitude?: number;
  longitude?: number;
  zone?: string;
  beatOrDistrict?: string;
  callerName?: string;
  callerPhone?: string;
  callerCallbackPhone?: string;
  units: UnifiedCadUnit[];
  callReceivedAt?: string;
  dispatchedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  clearedAt?: string;
  dedupeKey: string;
  isDuplicate: boolean;
  canonicalUnifiedId?: string;
  /** Audit-only. Stripped from client API responses. */
  rawVendorPayload?: Record<string, unknown>;
  ingestedAt: string;
  lastSyncAt: string;
  schemaVersion: number;
}

export const CAD_WRITE_BACK_STATUSES = [
  "pending_routing",
  "pending_approval",
  "approved",
  "rejected",
  "submitted",
  "delivered",
  "failed",
  "no_route",
] as const;

export type CadWriteBackStatus = (typeof CAD_WRITE_BACK_STATUSES)[number];

export interface CadWriteBackPayload {
  action: "update_status" | "add_narrative" | "assign_unit" | "close_incident" | "custom";
  fields: Record<string, string | number | boolean | null>;
  narrative?: string;
}

export interface CadWriteBackAuditEntry {
  at: string;
  actorId: string;
  action: string;
  detail?: string;
}

export interface CadWriteBackRequest {
  writeBackId: string;
  agencyId: string;
  unifiedId: string;
  requestedByUserId: string;
  requestedAt: string;
  status: CadWriteBackStatus;
  payload: CadWriteBackPayload;
  resolvedConnectorId?: string;
  supervisorApprovalByUserId?: string;
  supervisorApprovalAt?: string;
  submittedAt?: string;
  resultCode?: number;
  resultMessage?: string;
  rejectReason?: string;
  auditTrail: CadWriteBackAuditEntry[];
}

export interface CadHealthCheckResult {
  connectorId: string;
  status: "healthy" | "degraded" | "unreachable" | "auth_failure";
  latencyMs?: number;
  checkedAt: string;
  message?: string;
}

export const UNIFIED_CAD_INCIDENT_RC_FIELDS = [
  "vendorIncidentId",
  "vendorCallId",
  "cadIncidentNumber",
  "incidentType",
  "priority",
  "status",
  "nature",
  "address",
  "addressVerified",
  "latitude",
  "longitude",
  "zone",
  "beatOrDistrict",
  "callerName",
  "callerPhone",
  "callerCallbackPhone",
  "callReceivedAt",
  "dispatchedAt",
  "enRouteAt",
  "arrivedAt",
  "clearedAt",
] as const;

export type UnifiedCadIncidentRcField = (typeof UNIFIED_CAD_INCIDENT_RC_FIELDS)[number];
