import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  BridgeAuditRecord,
  BufferedOutboundEvent,
  CADBridgeConfig,
  CADSlot,
  CanonicalIncident,
  CircuitBreakerState,
  ConflictRecord,
} from "rapid-cortex-shared";
import {
  BUFFER_DEAD_TTL_SECONDS,
  BUFFER_TTL_SECONDS,
  LOOP_GUARD_TTL_MS,
  validateCadBridgeConfig,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

const SYNC_GSI = "gsi1";
const LOOP_SK = "OUTBOUND";

function requireTable(label: string, name: string): string {
  if (!name) throw new Error(`${label} is not configured`);
  return name;
}

function configTable(): string {
  return requireTable("CAD_BRIDGE_CONFIG_TABLE", env.cadBridgeConfigTable);
}
function syncTable(): string {
  return requireTable("CAD_BRIDGE_SYNC_TABLE", env.cadBridgeSyncTable);
}
function loopGuardTable(): string {
  return requireTable("CAD_BRIDGE_LOOP_GUARD_TABLE", env.cadBridgeLoopGuardTable);
}
function circuitBreakerTable(): string {
  return requireTable("CAD_BRIDGE_CB_TABLE", env.cadBridgeCircuitBreakerTable);
}
function bufferTable(): string {
  return requireTable("CAD_BRIDGE_BUFFER_TABLE", env.cadBridgeBufferTable);
}
function auditTable(): string {
  return requireTable("CAD_BRIDGE_AUDIT_TABLE", env.cadBridgeAuditTable);
}

function ttlEpochSeconds(fromNowMs: number): number {
  return Math.floor((Date.now() + fromNowMs) / 1000);
}

function ttlEpochFromSeconds(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

function circuitPk(agencyId: string, slot: CADSlot): string {
  return `${agencyId}#${slot}`;
}

function loopEventPk(agencyId: string, eventId: string): string {
  return `${agencyId}#${eventId}`;
}

function loopFingerprintPk(agencyId: string, fingerprint: string): string {
  return `${agencyId}#FP#${fingerprint}`;
}

function bufferPk(agencyId: string, slot: CADSlot): string {
  return `${agencyId}#${slot}`;
}

function bufferSk(queuedAt: string, eventId: string): string {
  return `${queuedAt}#${eventId}`;
}

function deadBufferPk(agencyId: string, slot: CADSlot): string {
  return `DEAD#${agencyId}#${slot}`;
}

function auditPk(agencyId: string, rcIncidentId: string): string {
  return `${agencyId}#${rcIncidentId}`;
}

export function isCadBridgeStoreConfigured(): boolean {
  return Boolean(
    env.cadBridgeConfigTable &&
      env.cadBridgeSyncTable &&
      env.cadBridgeLoopGuardTable &&
      env.cadBridgeCircuitBreakerTable &&
      env.cadBridgeBufferTable &&
      env.cadBridgeAuditTable,
  );
}

export const cadBridgeStore = {
  async getConfig(agencyId: string): Promise<CADBridgeConfig | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: configTable(),
        Key: { agencyId },
        ConsistentRead: true,
      }),
    );
    return (out.Item?.config as CADBridgeConfig | undefined) ?? null;
  },

  async putConfig(config: CADBridgeConfig, previousUpdatedAt?: string): Promise<void> {
    validateCadBridgeConfig(config);
    const next: CADBridgeConfig = { ...config, updatedAt: new Date().toISOString() };
    await ddb.send(
      new PutCommand({
        TableName: configTable(),
        Item: {
          agencyId: next.agencyId,
          config: next,
          updatedAt: next.updatedAt,
        },
        ...(previousUpdatedAt
          ? {
              ConditionExpression: "attribute_not_exists(agencyId) OR updatedAt = :prev",
              ExpressionAttributeValues: { ":prev": previousUpdatedAt },
            }
          : {}),
      }),
    );
  },

  async listConfigs(): Promise<CADBridgeConfig[]> {
    const configs: CADBridgeConfig[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const out = await ddb.send(
        new ScanCommand({
          TableName: configTable(),
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      for (const row of out.Items ?? []) {
        const config = row.config as CADBridgeConfig | undefined;
        if (config) configs.push(config);
      }
      exclusiveStartKey = out.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return configs;
  },

  async getIncident(agencyId: string, rcIncidentId: string): Promise<CanonicalIncident | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: syncTable(),
        Key: { pk: agencyId, sk: `INC#${rcIncidentId}` },
        ConsistentRead: true,
      }),
    );
    return (out.Item?.incident as CanonicalIncident | undefined) ?? null;
  },

  async getIncidentByVendorId(
    agencyId: string,
    slot: CADSlot,
    vendorIncidentId: string,
  ): Promise<CanonicalIncident | null> {
    const pointer = await ddb.send(
      new GetCommand({
        TableName: syncTable(),
        Key: { pk: agencyId, sk: `IDX#${slot}#${vendorIncidentId}` },
        ConsistentRead: true,
      }),
    );
    const rcIncidentId = pointer.Item?.rcIncidentId as string | undefined;
    if (!rcIncidentId) return null;
    return this.getIncident(agencyId, rcIncidentId);
  },

  async saveIncident(incident: CanonicalIncident): Promise<void> {
    const pendingXfer = incident.transferState?.status === "REQUESTED";
    await ddb.send(
      new PutCommand({
        TableName: syncTable(),
        Item: {
          pk: incident.agencyId,
          sk: `INC#${incident.rcIncidentId}`,
          incident,
          rcIncidentId: incident.rcIncidentId,
          updatedAt: incident.updatedAt,
          ...(pendingXfer
            ? {
                gsi1pk: "CAD_BRIDGE#XFER",
                gsi1sk: `${incident.transferState?.timeoutAt}#${incident.agencyId}#${incident.rcIncidentId}`,
              }
            : {}),
        },
      }),
    );
    await ddb.send(
      new PutCommand({
        TableName: syncTable(),
        Item: {
          pk: incident.agencyId,
          sk: `IDX#CAD_A#${incident.cadA.incidentId}`,
          rcIncidentId: incident.rcIncidentId,
        },
      }),
    );
    if (incident.cadB.incidentId) {
      await ddb.send(
        new PutCommand({
          TableName: syncTable(),
          Item: {
            pk: incident.agencyId,
            sk: `IDX#CAD_B#${incident.cadB.incidentId}`,
            rcIncidentId: incident.rcIncidentId,
          },
        }),
      );
    }
  },

  async listPendingTransfers(nowIso: string, limit = 50): Promise<CanonicalIncident[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: syncTable(),
        IndexName: SYNC_GSI,
        KeyConditionExpression: "gsi1pk = :pk AND gsi1sk <= :sk",
        ExpressionAttributeValues: {
          ":pk": "CAD_BRIDGE#XFER",
          ":sk": `${nowIso}\uffff`,
        },
        Limit: limit,
      }),
    );
    const incidents: CanonicalIncident[] = [];
    for (const row of out.Items ?? []) {
      const agencyId = String(row.pk ?? "");
      const sk = String(row.gsi1sk ?? "");
      const rcIncidentId = sk.split("#").pop() ?? "";
      if (!agencyId || !rcIncidentId) continue;
      const incident = await this.getIncident(agencyId, rcIncidentId);
      if (incident) incidents.push(incident);
    }
    return incidents;
  },

  async putConflict(agencyId: string, rcIncidentId: string, conflict: ConflictRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: syncTable(),
        Item: {
          pk: agencyId,
          sk: `CONFLICT#${conflict.conflictId}`,
          gsi1pk: `CAD_BRIDGE#CONFLICT#${agencyId}`,
          gsi1sk: `${conflict.detectedAt}#${conflict.conflictId}`,
          rcIncidentId,
          conflict,
        },
      }),
    );
  },

  async listConflicts(agencyId: string, limit = 50): Promise<Array<ConflictRecord & { rcIncidentId: string }>> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: syncTable(),
        IndexName: SYNC_GSI,
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": `CAD_BRIDGE#CONFLICT#${agencyId}` },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []).map((row) => ({
      ...(row.conflict as ConflictRecord),
      rcIncidentId: String(row.rcIncidentId ?? ""),
    }));
  },

  async deleteConflict(agencyId: string, conflictId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: syncTable(),
        Key: { pk: agencyId, sk: `CONFLICT#${conflictId}` },
      }),
    );
  },

  async putAudit(record: BridgeAuditRecord): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: auditTable(),
          Item: {
            pk: auditPk(record.agencyId, record.rcIncidentId),
            sk: `${record.timestamp}#${record.eventId}`,
            ...record,
          },
        }),
      );
    } catch {
      console.error("[cad-bridge] audit write failed", { eventId: record.eventId });
    }
  },

  async listAudit(agencyId: string, rcIncidentId: string, limit = 50): Promise<BridgeAuditRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: auditTable(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": auditPk(agencyId, rcIncidentId) },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as BridgeAuditRecord[];
  },

  async registerLoopEvent(agencyId: string, eventId: string, fingerprint: string): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: loopGuardTable(),
        Item: {
          pk: loopEventPk(agencyId, eventId),
          sk: LOOP_SK,
          fingerprint,
          ttl: ttlEpochSeconds(LOOP_GUARD_TTL_MS),
        },
      }),
    );
  },

  async registerLoopFingerprint(agencyId: string, fingerprint: string, eventId: string): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: loopGuardTable(),
        Item: {
          pk: loopFingerprintPk(agencyId, fingerprint),
          sk: LOOP_SK,
          eventId,
          ttl: ttlEpochSeconds(LOOP_GUARD_TTL_MS),
        },
      }),
    );
  },

  async hasLoopEvent(agencyId: string, eventId: string): Promise<boolean> {
    try {
      const out = await ddb.send(
        new GetCommand({
          TableName: loopGuardTable(),
          Key: { pk: loopEventPk(agencyId, eventId), sk: LOOP_SK },
        }),
      );
      return Boolean(out.Item);
    } catch {
      return false;
    }
  },

  async hasLoopFingerprint(agencyId: string, fingerprint: string): Promise<boolean> {
    try {
      const out = await ddb.send(
        new GetCommand({
          TableName: loopGuardTable(),
          Key: { pk: loopFingerprintPk(agencyId, fingerprint), sk: LOOP_SK },
        }),
      );
      return Boolean(out.Item);
    } catch {
      return false;
    }
  },

  async getCircuitBreaker(agencyId: string, slot: CADSlot): Promise<CircuitBreakerState | null> {
    try {
      const out = await ddb.send(
        new GetCommand({
          TableName: circuitBreakerTable(),
          Key: { pk: circuitPk(agencyId, slot) },
        }),
      );
      if (!out.Item) return null;
      const { pk: _pk, ttl: _ttl, ...rest } = out.Item as CircuitBreakerState & { pk?: string; ttl?: number };
      return rest as CircuitBreakerState;
    } catch {
      return null;
    }
  },

  async putCircuitBreaker(state: CircuitBreakerState): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: circuitBreakerTable(),
        Item: {
          ...state,
          pk: circuitPk(state.agencyId, state.cadSlot),
          ttl: ttlEpochFromSeconds(3600),
        },
      }),
    );
  },

  async incrementCircuitFailure(agencyId: string, slot: CADSlot): Promise<number> {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: circuitBreakerTable(),
        Key: { pk: circuitPk(agencyId, slot) },
        UpdateExpression:
          "SET failureCount = if_not_exists(failureCount, :z) + :one, lastFailureAt = :now, #st = if_not_exists(#st, :closed), cadSlot = :slot, agencyId = :agency, ttl = :ttl",
        ExpressionAttributeNames: { "#st": "state" },
        ExpressionAttributeValues: {
          ":z": 0,
          ":one": 1,
          ":now": new Date().toISOString(),
          ":closed": "CLOSED",
          ":slot": slot,
          ":agency": agencyId,
          ":ttl": ttlEpochFromSeconds(3600),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return Number(out.Attributes?.failureCount ?? 0);
  },

  async putBuffer(event: BufferedOutboundEvent): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: bufferTable(),
        Item: {
          pk: bufferPk(event.agencyId, event.destinationSlot),
          sk: bufferSk(event.queuedAt, event.eventId),
          ttl: event.expiresAt || ttlEpochFromSeconds(BUFFER_TTL_SECONDS),
          ...event,
        },
      }),
    );
  },

  /** Oldest-first for one agency/slot. SK is queuedAt#eventId. */
  async listBufferedForSlot(
    agencyId: string,
    destinationSlot: CADSlot,
    limit = 20,
  ): Promise<BufferedOutboundEvent[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: bufferTable(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": bufferPk(agencyId, destinationSlot) },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as BufferedOutboundEvent[];
  },

  async incrementBufferAttempt(
    event: BufferedOutboundEvent,
    errorCode?: string,
  ): Promise<BufferedOutboundEvent> {
    const next: BufferedOutboundEvent = {
      ...event,
      attemptCount: event.attemptCount + 1,
      lastAttemptAt: new Date().toISOString(),
      lastErrorCode: errorCode,
    };
    await this.putBuffer(next);
    return next;
  },

  /** Write DEAD# then delete the live row so replay is not blocked. TTL 7 days. */
  async deadLetterBuffer(event: BufferedOutboundEvent, errorCode?: string): Promise<void> {
    const ttl = ttlEpochFromSeconds(BUFFER_DEAD_TTL_SECONDS);
    await ddb.send(
      new PutCommand({
        TableName: bufferTable(),
        Item: {
          ...event,
          pk: deadBufferPk(event.agencyId, event.destinationSlot),
          sk: bufferSk(event.queuedAt, event.eventId),
          agencyId: event.agencyId,
          ttl,
          droppedAt: new Date().toISOString(),
          lastErrorCode: errorCode ?? event.lastErrorCode,
          attemptCount: Math.max(event.attemptCount, 1),
        },
      }),
    );
    await this.deleteBuffer(event.agencyId, event.destinationSlot, event.queuedAt, event.eventId);
  },

  async countBuffered(agencyId: string): Promise<number> {
    let count = 0;
    for (const slot of ["CAD_A", "CAD_B"] as const) {
      const out = await ddb.send(
        new QueryCommand({
          TableName: bufferTable(),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": bufferPk(agencyId, slot) },
          Select: "COUNT",
        }),
      );
      count += out.Count ?? 0;
    }
    return count;
  },

  async deleteBuffer(agencyId: string, destinationSlot: CADSlot, queuedAt: string, eventId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: bufferTable(),
        Key: { pk: bufferPk(agencyId, destinationSlot), sk: bufferSk(queuedAt, eventId) },
      }),
    );
  },
};
