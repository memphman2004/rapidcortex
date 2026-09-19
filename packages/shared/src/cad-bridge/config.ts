import type {
  BridgeEventType,
  BridgeSyncRules,
  CADBridgeConfig,
  CADBridgeExtraSlot,
  CADSlot,
  CADSlotConfig,
  CadSlotLink,
  CanonicalIncident,
} from "./schemas.js";
import {
  CAD_BRIDGE_EXTRA_SLOTS,
  CAD_BRIDGE_MAX_PARTICIPANTS,
  CAD_BRIDGE_SECRET_ARN_PREFIXES,
  CAD_BRIDGE_SLOTS,
} from "./schemas.js";

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

export type CadBridgeParticipant = CADSlotConfig & { slot: CADSlot; label?: string };

export function isCadBridgeSecretArn(arn: string): boolean {
  return CAD_BRIDGE_SECRET_ARN_PREFIXES.some((prefix) => arn.includes(prefix));
}

export function isCadBridgeExtraSlot(slot: string): slot is CADBridgeExtraSlot {
  return (CAD_BRIDGE_EXTRA_SLOTS as readonly string[]).includes(slot);
}

export function parseCadSlotPathToken(token: string): CADSlot | null {
  const match = token.trim().toLowerCase().match(/^cad-([a-h])$/);
  if (!match?.[1]) return null;
  return `CAD_${match[1].toUpperCase()}` as CADSlot;
}

export function cadSlotPathToken(slot: CADSlot): string {
  return slot.replace("_", "-").toLowerCase();
}

export function cadBridgeAuditDirection(from: CADSlot, to: CADSlot): string {
  if (from === "CAD_A" && to === "CAD_B") return "CAD_A_TO_B";
  if (from === "CAD_B" && to === "CAD_A") return "CAD_B_TO_A";
  return `${from}_TO_${to}`;
}

export function listCadBridgeParticipants(config: CADBridgeConfig): CadBridgeParticipant[] {
  const extras = config.extraParticipants ?? [];
  return [
    { slot: "CAD_A" as const, ...config.cadA },
    { slot: "CAD_B" as const, ...config.cadB },
    ...extras,
  ];
}

export function getCadSlotConfig(config: CADBridgeConfig, slot: CADSlot): CADSlotConfig | undefined {
  return listCadBridgeParticipants(config).find((p) => p.slot === slot);
}

export function fanoutCadSlots(config: CADBridgeConfig, sourceSlot: CADSlot): CADSlot[] {
  return listCadBridgeParticipants(config)
    .filter((p) => p.slot !== sourceSlot && p.outboundEnabled)
    .map((p) => p.slot);
}

export function nextAvailableCadSlot(config: CADBridgeConfig): CADBridgeExtraSlot | undefined {
  const used = new Set(listCadBridgeParticipants(config).map((p) => p.slot));
  return CAD_BRIDGE_EXTRA_SLOTS.find((slot) => !used.has(slot));
}

export function getIncidentLink(incident: CanonicalIncident, slot: CADSlot): CadSlotLink | undefined {
  if (slot === "CAD_A") return incident.cadA;
  if (slot === "CAD_B") return incident.cadB;
  return incident.extraLinks?.[slot];
}

export function setIncidentLink(
  incident: CanonicalIncident,
  slot: CADSlot,
  patch: Partial<CadSlotLink> & { vendor?: CadSlotLink["vendor"] },
): CanonicalIncident {
  const nowIso = patch.lastSyncedAt;
  if (slot === "CAD_A") {
    return {
      ...incident,
      cadA: {
        ...incident.cadA,
        ...patch,
        incidentId: patch.incidentId ?? incident.cadA.incidentId,
        vendor: patch.vendor ?? incident.cadA.vendor,
        ...(nowIso ? { lastSyncedAt: nowIso } : {}),
      },
    };
  }
  if (slot === "CAD_B") {
    return {
      ...incident,
      cadB: {
        ...incident.cadB,
        ...patch,
        vendor: patch.vendor ?? incident.cadB.vendor,
        ...(nowIso ? { lastSyncedAt: nowIso } : {}),
      },
    };
  }
  const existing = incident.extraLinks?.[slot];
  const vendor = patch.vendor ?? existing?.vendor;
  if (!vendor) return incident;
  return {
    ...incident,
    extraLinks: {
      ...incident.extraLinks,
      [slot]: {
        ...existing,
        ...patch,
        vendor,
        ...(nowIso ? { lastSyncedAt: nowIso } : {}),
      },
    },
  };
}

export function listIncidentLinkedSlots(incident: CanonicalIncident): CADSlot[] {
  const slots: CADSlot[] = [];
  if (incident.cadA.incidentId) slots.push("CAD_A");
  if (incident.cadB.incidentId) slots.push("CAD_B");
  for (const slot of CAD_BRIDGE_EXTRA_SLOTS) {
    if (incident.extraLinks?.[slot]?.incidentId) slots.push(slot);
  }
  return slots;
}

function validateSlot(slotName: string, slot: CADSlotConfig, requireLiveSecrets: boolean): void {
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

  const extras = config.extraParticipants ?? [];
  if (extras.length > CAD_BRIDGE_MAX_PARTICIPANTS - 2) {
    throw new CadBridgeConfigValidationError(
      `extraParticipants cannot exceed ${CAD_BRIDGE_MAX_PARTICIPANTS - 2} (hub max ${CAD_BRIDGE_MAX_PARTICIPANTS})`,
    );
  }
  const seen = new Set<CADSlot>(["CAD_A", "CAD_B"]);
  for (const extra of extras) {
    if (seen.has(extra.slot)) {
      throw new CadBridgeConfigValidationError(`duplicate CAD participant slot ${extra.slot}`);
    }
    seen.add(extra.slot);
    validateSlot(extra.slot, extra, config.enabled);
  }

  const participants = listCadBridgeParticipants(config);
  if (!participants.some((p) => p.slot === config.primaryCAD)) {
    throw new CadBridgeConfigValidationError("primaryCAD must be a configured participant");
  }
  if (config.transferTimeoutSeconds < 30 || config.transferTimeoutSeconds > 3600) {
    throw new CadBridgeConfigValidationError("transferTimeoutSeconds must be between 30 and 3600");
  }
  if (config.bufferMaxEvents < 10 || config.bufferMaxEvents > 10_000) {
    throw new CadBridgeConfigValidationError("bufferMaxEvents must be between 10 and 10000");
  }
}

export function emptyCadSlotConfig(vendor: CADSlotConfig["vendor"] = "CENTRALSQUARE"): CADSlotConfig {
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
    cadA: emptyCadSlotConfig("MOTOROLA"),
    cadB: emptyCadSlotConfig("TYLER"),
    extraParticipants: [],
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

/** Pairwise A↔B fallback used when only two CADs are configured. */
export function oppositeCadSlot(slot: CADSlot): CADSlot {
  return slot === "CAD_A" ? "CAD_B" : "CAD_A";
}