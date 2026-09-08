import { z } from "zod";

/** Vendor identities used on the CAD-to-CAD bridge. Distinct from ingest `cadVendorSchema`. */
export const cadBridgeVendorSchema = z.enum([
  "MOTOROLA",
  "TYLER",
  "CENTRALSQUARE",
  "HEXAGON",
  "SPILLMAN",
]);
export type CADVendor = z.infer<typeof cadBridgeVendorSchema>;

export const cadSlotSchema = z.enum(["CAD_A", "CAD_B"]);
export type CADSlot = z.infer<typeof cadSlotSchema>;

export const incidentPrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type IncidentPriority = z.infer<typeof incidentPrioritySchema>;

export const conflictStrategySchema = z.enum([
  "PRIMARY_WINS",
  "LAST_WRITE_WINS",
  "MANUAL_REVIEW",
]);
export type ConflictStrategy = z.infer<typeof conflictStrategySchema>;

export const incidentStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "DISPATCHED",
  "ONSCENE",
  "CLEARING",
  "CLOSED",
  "CANCELLED",
]);
export type CadBridgeIncidentStatus = z.infer<typeof incidentStatusSchema>;

export const unitStatusSchema = z.enum([
  "AVAILABLE",
  "DISPATCHED",
  "ENROUTE",
  "ONSCENE",
  "TRANSPORTING",
  "UNAVAILABLE",
  "OUT_OF_SERVICE",
]);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

export const bridgeEventTypeSchema = z.enum([
  "INCIDENT_CREATED",
  "INCIDENT_UPDATED",
  "INCIDENT_CLOSED",
  "INCIDENT_CANCELLED",
  "UNIT_STATUS_CHANGED",
  "UNIT_ASSIGNED",
  "UNIT_RELEASED",
  "COMMENT_ADDED",
  "PRIORITY_CHANGED",
  "TYPE_CHANGED",
  "LOCATION_UPDATED",
  "TRANSFER_REQUESTED",
  "TRANSFER_ACCEPTED",
  "TRANSFER_CANCELLED",
]);
export type BridgeEventType = z.infer<typeof bridgeEventTypeSchema>;

export const incidentSyncStatusSchema = z.enum([
  "PENDING_MIRROR",
  "IN_SYNC",
  "SYNC_PENDING",
  "CONFLICT",
  "ERROR",
  "BUFFERED",
]);
export type IncidentSyncStatus = z.infer<typeof incidentSyncStatusSchema>;

export const transferStatusSchema = z.enum([
  "REQUESTED",
  "ACCEPTED",
  "CANCELLED",
  "TIMED_OUT",
]);
export type TransferStatus = z.infer<typeof transferStatusSchema>;

export const bridgeOutcomeSchema = z.enum([
  "SUCCESS",
  "FAILED",
  "CONFLICT",
  "SKIPPED",
  "BUFFERED",
  "LOOP_DETECTED",
]);
export type BridgeOutcome = z.infer<typeof bridgeOutcomeSchema>;

export const circuitBreakerStateNameSchema = z.enum(["CLOSED", "OPEN", "HALF_OPEN"]);
export type CircuitBreakerStateName = z.infer<typeof circuitBreakerStateNameSchema>;

export const canonicalLocationSchema = z.object({
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string().optional(),
  crossStreets: z.string().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  unit: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationId: z.string().optional(),
  premiseFlags: z.array(z.string()).optional(),
});
export type CanonicalLocation = z.infer<typeof canonicalLocationSchema>;

export const canonicalUnitSchema = z.object({
  unitId: z.string(),
  cadSlot: cadSlotSchema,
  callSign: z.string(),
  status: unitStatusSchema,
  radioId: z.string().optional(),
  dispatchedAt: z.string().optional(),
  enrouteAt: z.string().optional(),
  onSceneAt: z.string().optional(),
  clearedAt: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type CanonicalUnit = z.infer<typeof canonicalUnitSchema>;

export const canonicalCommentSchema = z.object({
  commentId: z.string(),
  cadSlot: cadSlotSchema,
  sourceIncidentId: z.string(),
  text: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  timestamp: z.string(),
  isBridged: z.boolean(),
  rcBridgeToken: z.string().optional(),
});
export type CanonicalComment = z.infer<typeof canonicalCommentSchema>;

export const canonicalCallerSchema = z.object({
  callbackNumber: z.string().optional(),
  name: z.string().optional(),
  ani: z.string().optional(),
  ali: z.string().optional(),
});
export type CanonicalCaller = z.infer<typeof canonicalCallerSchema>;

export const conflictRecordSchema = z.object({
  conflictId: z.string(),
  field: z.string(),
  cadAValue: z.unknown(),
  cadBValue: z.unknown(),
  cadATimestamp: z.string(),
  cadBTimestamp: z.string(),
  detectedAt: z.string(),
  resolvedAt: z.string().optional(),
  resolution: conflictStrategySchema.optional(),
  resolvedBy: z.string().optional(),
});
export type ConflictRecord = z.infer<typeof conflictRecordSchema>;

export const transferStateSchema = z.object({
  status: transferStatusSchema,
  fromSlot: cadSlotSchema,
  toSlot: cadSlotSchema,
  requestedAt: z.string(),
  requestedBy: z.string(),
  acceptedAt: z.string().optional(),
  acceptedBy: z.string().optional(),
  cancelledAt: z.string().optional(),
  timeoutAt: z.string(),
});
export type TransferState = z.infer<typeof transferStateSchema>;

export const cadSlotLinkSchema = z.object({
  incidentId: z.string().optional(),
  vendor: cadBridgeVendorSchema,
  lastSyncedAt: z.string().optional(),
  lastVersion: z.string().optional(),
});
export type CadSlotLink = z.infer<typeof cadSlotLinkSchema>;

export const canonicalIncidentSchema = z.object({
  rcIncidentId: z.string(),
  agencyId: z.string(),
  owner: cadSlotSchema,
  cadA: cadSlotLinkSchema.extend({ incidentId: z.string() }),
  cadB: cadSlotLinkSchema,
  type: z.string(),
  priority: incidentPrioritySchema,
  status: incidentStatusSchema,
  location: canonicalLocationSchema,
  caller: canonicalCallerSchema,
  narrative: z.string(),
  units: z.array(canonicalUnitSchema),
  comments: z.array(canonicalCommentSchema),
  syncState: incidentSyncStatusSchema,
  pendingConflicts: z.array(conflictRecordSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().optional(),
  transferState: transferStateSchema.optional(),
});
export type CanonicalIncident = z.infer<typeof canonicalIncidentSchema>;

export const bridgeEventSchema = z.object({
  eventId: z.string(),
  agencyId: z.string(),
  sourceSlot: cadSlotSchema,
  eventType: bridgeEventTypeSchema,
  sourceIncidentId: z.string(),
  rcIncidentId: z.string().optional(),
  rawPayload: z.record(z.unknown()),
  canonical: canonicalIncidentSchema.partial().optional(),
  receivedAt: z.string(),
  rcBridgeToken: z.string().optional(),
});
export type BridgeEvent = z.infer<typeof bridgeEventSchema>;

export const cadSlotConfigSchema = z.object({
  vendor: cadBridgeVendorSchema,
  baseUrl: z.string(),
  apiKeySecretArn: z.string(),
  webhookSigningSecretArn: z.string(),
  inboundEnabled: z.boolean(),
  outboundEnabled: z.boolean(),
  pollingIntervalSeconds: z.number().int().min(15).max(3600).optional(),
  timeoutMs: z.number().int().min(1000).max(30_000),
  retryAttempts: z.number().int().min(1).max(8),
  retryBackoffMs: z.number().int().min(100).max(30_000),
});
export type CADSlotConfig = z.infer<typeof cadSlotConfigSchema>;

export const bridgeSyncRulesSchema = z.object({
  syncIncidentCreate: z.boolean(),
  syncIncidentUpdate: z.boolean(),
  syncIncidentClose: z.boolean(),
  syncIncidentCancel: z.boolean(),
  syncUnitStatus: z.boolean(),
  syncUnitAssignment: z.boolean(),
  syncComments: z.boolean(),
  syncPriorityChanges: z.boolean(),
  syncTypeChanges: z.boolean(),
  syncLocationUpdates: z.boolean(),
  syncTransfers: z.boolean(),
});
export type BridgeSyncRules = z.infer<typeof bridgeSyncRulesSchema>;

export const cadBridgeConfigSchema = z.object({
  agencyId: z.string().min(1),
  bridgeId: z.string().min(1),
  enabled: z.boolean(),
  cadA: cadSlotConfigSchema,
  cadB: cadSlotConfigSchema,
  primaryCAD: cadSlotSchema,
  syncRules: bridgeSyncRulesSchema,
  conflictResolution: conflictStrategySchema,
  transferTimeoutSeconds: z.number().int().min(30).max(3600),
  bufferMaxEvents: z.number().int().min(10).max(10_000),
  fieldMappingOverrides: z.record(z.record(z.string())),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CADBridgeConfig = z.infer<typeof cadBridgeConfigSchema>;

export const cadBridgeConfigPutSchema = cadBridgeConfigSchema.omit({
  agencyId: true,
  createdAt: true,
  updatedAt: true,
  bridgeId: true,
}).extend({
  bridgeId: z.string().min(1).optional(),
});
export type CADBridgeConfigPut = z.infer<typeof cadBridgeConfigPutSchema>;

export const cadBridgeEnabledPatchSchema = z.object({
  enabled: z.boolean(),
});

export const cadBridgeSyncRulesPatchSchema = bridgeSyncRulesSchema.partial();

export const cadBridgeConflictResolveSchema = z.object({
  conflictId: z.string().min(1),
  resolution: conflictStrategySchema,
  /** When LAST_WRITE_WINS / MANUAL pick, which slot's value to keep. */
  keepSlot: cadSlotSchema.optional(),
});

export const cadBridgeTransferRequestSchema = z.object({
  toSlot: cadSlotSchema,
});

export const cadBridgeAuditRecordSchema = z.object({
  agencyId: z.string(),
  eventId: z.string(),
  rcIncidentId: z.string(),
  direction: z.enum(["CAD_A_TO_B", "CAD_B_TO_A"]),
  eventType: bridgeEventTypeSchema,
  sourceIncidentId: z.string(),
  destinationIncidentId: z.string().optional(),
  sourcePayloadHash: z.string(),
  outboundPayloadHash: z.string().optional(),
  outcome: bridgeOutcomeSchema,
  conflictIds: z.array(z.string()).optional(),
  errorCode: z.string().optional(),
  errorDetail: z.string().optional(),
  durationMs: z.number(),
  timestamp: z.string(),
});
export type BridgeAuditRecord = z.infer<typeof cadBridgeAuditRecordSchema>;

export const bufferedOutboundHttpMethodSchema = z.enum(["POST", "PUT", "PATCH"]);

export const bufferedOutboundEventSchema = z.object({
  eventId: z.string(),
  agencyId: z.string(),
  destinationSlot: cadSlotSchema,
  rcIncidentId: z.string(),
  eventType: bridgeEventTypeSchema,
  /** Exact vendor payload already translated at buffer time — replay must not rebuild this. */
  outboundPayload: z.record(z.unknown()),
  endpoint: z.string().min(1),
  method: bufferedOutboundHttpMethodSchema,
  queuedAt: z.string(),
  attemptCount: z.number().int().min(0),
  lastAttemptAt: z.string().optional(),
  lastErrorCode: z.string().optional(),
  expiresAt: z.number().int(),
});
export type BufferedOutboundEvent = z.infer<typeof bufferedOutboundEventSchema>;

export const circuitBreakerStateSchema = z.object({
  agencyId: z.string(),
  cadSlot: cadSlotSchema,
  state: circuitBreakerStateNameSchema,
  failureCount: z.number().int().min(0),
  lastFailureAt: z.string().optional(),
  openedAt: z.string().optional(),
  expiresAt: z.number().int().optional(),
});
export type CircuitBreakerState = z.infer<typeof circuitBreakerStateSchema>;

/** Canonical Secrets Manager path (Rapid Cortex). */
export const CAD_BRIDGE_SECRET_ARN_PREFIX = "rapid-cortex/cad-bridge/";
/** Alternate prefix from the standalone CAD-bridge template. IAM allows both. */
export const CAD_BRIDGE_SECRET_ARN_PREFIX_LEGACY = "rc-cad-bridge/";
export const CAD_BRIDGE_SECRET_ARN_PREFIXES = [
  CAD_BRIDGE_SECRET_ARN_PREFIX,
  CAD_BRIDGE_SECRET_ARN_PREFIX_LEGACY,
] as const;
export const RC_BRIDGE_SOURCE_HEADER = "RC_BRIDGE";
export const RC_BRIDGE_COMMENT_PREFIX = "[RC-BRIDGE:";
export const LOOP_GUARD_TTL_MS = 60_000;
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
export const CIRCUIT_BREAKER_RESET_SECONDS = 60;
export const BUFFER_TTL_SECONDS = 24 * 60 * 60;
/** Dropped buffer rows stay 7 days under DEAD# for audit, then TTL. */
export const BUFFER_DEAD_TTL_SECONDS = 7 * 24 * 60 * 60;
export const BUFFER_MAX_RETRY_ATTEMPTS = 5;
export const DEFAULT_TRANSFER_TIMEOUT_SECONDS = 300;
export const CAD_BRIDGE_METRIC_NAMESPACE = "RapidCortex/CADBridge";
