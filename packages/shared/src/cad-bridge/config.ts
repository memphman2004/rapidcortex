import type { BridgeEventType, BridgeSyncRules, CADBridgeConfig, CADSlotConfig } from "./schemas.js";
import { CAD_BRIDGE_SECRET_ARN_PREFIXES } from "./schemas.js";

export const DEFAULT_BRIDGE_SYNC_RULES: BridgeSyncRules = {
  syncIncidentCreate: true,
  syncIncidentUpdate: true,
  syncIncidentClose: true,
  syncIncidentCancel: true,
  syncUnitStatus: true,
  syncUnitAssignment: true,
  syncComments: true,
  syncPriorityChanges: true,
  syncTypeChanges: true,
  syncLocationUpdates: false,
  syncTransfers: false,
};

export class CadBridgeConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CadBridgeConfigValidationError";
  }
}

export function isCadBridgeSecretArn(arn: string): boolean {
  return CAD_BRIDGE_SECRET_ARN_PREFIXES.some((prefix) => arn.includes(prefix));
}

function validateSlot(slotName: "cadA" | "cadB", slot: CADSlotConfig, requireLiveSecrets: boolean): void {
  if (!slot.vendor) throw new CadBridgeConfigValidationError(`${slotName}.vendor is required`);
  if (requireLiveSecrets && !slot.baseUrl) {
    throw new CadBridgeConfigValidationError(`${slotName}.baseUrl is required`);
  }
  if (slot.baseUrl && !slot.baseUrl.startsWith("https://") && !slot.baseUrl.startsWith("http://localhost")) {
    throw new CadBridgeConfigValidationError(`${slotName}.baseUrl must use HTTPS`);
  }
  if (slot.timeoutMs < 1000 || slot.timeoutMs > 30_000) {
    throw new CadBridgeConfigValidationError(`${slotName}.timeoutMs must be between 1000 and 30000`);
  }
  if (requireLiveSecrets) {
    if (!slot.apiKeySecretArn) {
      throw new CadBridgeConfigValidationError(`${slotName}.apiKeySecretArn is required when the bridge is enabled`);
    }
    if (!slot.webhookSigningSecretArn) {
      throw new CadBridgeConfigValidationError(
        `${slotName}.webhookSigningSecretArn is required when the bridge is enabled`,
      );
    }
    if (slot.apiKeySecretArn && !isCadBridgeSecretArn(slot.apiKeySecretArn)) {
      throw new CadBridgeConfigValidationError(
        `${slotName}.apiKeySecretArn must be under Secrets Manager path rapid-cortex/cad-bridge/ or rc-cad-bridge/`,
      );
    }
    if (slot.webhookSigningSecretArn && !isCadBridgeSecretArn(slot.webhookSigningSecretArn)) {
      throw new CadBridgeConfigValidationError(
        `${slotName}.webhookSigningSecretArn must be under Secrets Manager path rapid-cortex/cad-bridge/ or rc-cad-bridge/`,
      );
    }
  }
}

export function validateCadBridgeConfig(config: CADBridgeConfig): void {
  if (!config.agencyId) throw new CadBridgeConfigValidationError("agencyId is required");
  if (!config.bridgeId) throw new CadBridgeConfigValidationError("bridgeId is required");
  validateSlot("cadA", config.cadA, config.enabled);
  validateSlot("cadB", config.cadB, config.enabled);
  if (config.transferTimeoutSeconds < 30 || config.transferTimeoutSeconds > 3600) {
    throw new CadBridgeConfigValidationError("transferTimeoutSeconds must be between 30 and 3600");
  }
  if (config.bufferMaxEvents < 10 || config.bufferMaxEvents > 10_000) {
    throw new CadBridgeConfigValidationError("bufferMaxEvents must be between 10 and 10000");
  }
}

function emptySlot(vendor: CADSlotConfig["vendor"]): CADSlotConfig {
  return {
    vendor,
    baseUrl: "",
    apiKeySecretArn: "",
    webhookSigningSecretArn: "",
    inboundEnabled: false,
    outboundEnabled: false,
    timeoutMs: 8000,
    retryAttempts: 3,
    retryBackoffMs: 500,
  };
}

/** Safe scaffold for the admin UI. Always disabled until UAT turns the bridge on. */
export function buildDefaultCadBridgeConfig(agencyId: string, bridgeId: string): CADBridgeConfig {
  const now = new Date().toISOString();
  return {
    agencyId,
    bridgeId,
    enabled: false,
    cadA: emptySlot("MOTOROLA"),
    cadB: emptySlot("TYLER"),
    primaryCAD: "CAD_A",
    syncRules: { ...DEFAULT_BRIDGE_SYNC_RULES },
    conflictResolution: "PRIMARY_WINS",
    transferTimeoutSeconds: 300,
    bufferMaxEvents: 1000,
    fieldMappingOverrides: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function shouldSyncEvent(eventType: BridgeEventType, rules: BridgeSyncRules): boolean {
  switch (eventType) {
    case "INCIDENT_CREATED":
      return rules.syncIncidentCreate;
    case "INCIDENT_UPDATED":
      return rules.syncIncidentUpdate;
    case "INCIDENT_CLOSED":
      return rules.syncIncidentClose;
    case "INCIDENT_CANCELLED":
      return rules.syncIncidentCancel;
    case "UNIT_STATUS_CHANGED":
      return rules.syncUnitStatus;
    case "UNIT_ASSIGNED":
    case "UNIT_RELEASED":
      return rules.syncUnitAssignment;
    case "COMMENT_ADDED":
      return rules.syncComments;
    case "PRIORITY_CHANGED":
      return rules.syncPriorityChanges;
    case "TYPE_CHANGED":
      return rules.syncTypeChanges;
    case "LOCATION_UPDATED":
      return rules.syncLocationUpdates;
    case "TRANSFER_REQUESTED":
    case "TRANSFER_ACCEPTED":
    case "TRANSFER_CANCELLED":
      return rules.syncTransfers;
    default:
      return false;
  }
}

export function oppositeCadSlot(slot: CADBridgeConfig["primaryCAD"]): CADBridgeConfig["primaryCAD"] {
  return slot === "CAD_A" ? "CAD_B" : "CAD_A";
}
