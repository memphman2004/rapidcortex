import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { UnifiedCadIncident } from "rapid-cortex-shared";
import { cadConnectorTableNames } from "../env.js";
import { CadDeduplicationEngine, type DeduplicationResult } from "./CadDeduplicationEngine.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

function incidentsTable(): string {
  const name = cadConnectorTableNames().incidents;
  if (!name) throw new Error("CAD_UNIFIED_INCIDENTS_TABLE is not set");
  return name;
}

export function stripRawVendorPayload(incident: UnifiedCadIncident): UnifiedCadIncident {
  const { rawVendorPayload: _raw, ...rest } = incident;
  return rest;
}

export class CadUnifiedIncidentStore {
  async get(agencyId: string, unifiedId: string): Promise<UnifiedCadIncident | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: incidentsTable(),
        Key: { agencyId: agencyId.trim(), unifiedId: unifiedId.trim() },
      }),
    );
    const item = result.Item as UnifiedCadIncident | undefined;
    if (!item || item.agencyId !== agencyId.trim()) return null;
    return item;
  }

  async put(incident: UnifiedCadIncident): Promise<void> {
    const ttlEpoch = Math.floor(Date.now() / 1000) + THIRTY_DAYS_S;
    await ddb.send(
      new PutCommand({
        TableName: incidentsTable(),
        Item: {
          ...incident,
          vendorKey: `${incident.connectorId}#${incident.vendorIncidentId}`,
          ttlEpoch,
        },
        ConditionExpression: "attribute_not_exists(agencyId) OR agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": incident.agencyId },
      }),
    );
  }

  async findExact(agencyId: string, connectorId: string, vendorIncidentId: string): Promise<UnifiedCadIncident | null> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: incidentsTable(),
        IndexName: "agencyId-vendorKey-index",
        KeyConditionExpression: "agencyId = :agencyId AND vendorKey = :vendorKey",
        ExpressionAttributeValues: {
          ":agencyId": agencyId.trim(),
          ":vendorKey": `${connectorId}#${vendorIncidentId}`,
        },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0] as UnifiedCadIncident | undefined;
    return item && item.agencyId === agencyId.trim() ? item : null;
  }

  async findByDedupeKey(agencyId: string, dedupeKey: string): Promise<UnifiedCadIncident[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: incidentsTable(),
        IndexName: "agencyId-dedupeKey-index",
        KeyConditionExpression: "agencyId = :agencyId AND dedupeKey = :dedupeKey",
        ExpressionAttributeValues: {
          ":agencyId": agencyId.trim(),
          ":dedupeKey": dedupeKey,
        },
      }),
    );
    return ((result.Items ?? []) as UnifiedCadIncident[]).filter((row) => row.agencyId === agencyId.trim());
  }

  async list(params: {
    agencyId: string;
    status?: string;
    connectorId?: string;
    department?: string;
    activeOnly?: boolean;
    limit: number;
    cursor?: { unifiedId: string };
  }): Promise<{ items: UnifiedCadIncident[]; nextCursor?: string }> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: incidentsTable(),
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": params.agencyId.trim() },
        ScanIndexForward: false,
        Limit: Math.min(100, Math.max(1, params.limit)),
        ExclusiveStartKey: params.cursor
          ? { agencyId: params.agencyId.trim(), unifiedId: params.cursor.unifiedId }
          : undefined,
      }),
    );
    const active = new Set(["pending", "queued", "dispatched", "en_route", "on_scene"]);
    let items = (result.Items ?? []) as UnifiedCadIncident[];
    items = items.filter((row) => row.agencyId === params.agencyId.trim());
    if (params.status) items = items.filter((row) => row.status === params.status);
    if (params.connectorId) items = items.filter((row) => row.connectorId === params.connectorId);
    if (params.department) items = items.filter((row) => row.department === params.department);
    if (params.activeOnly) items = items.filter((row) => active.has(row.status));
    const last = result.LastEvaluatedKey as { unifiedId?: string } | undefined;
    return { items, nextCursor: last?.unifiedId };
  }

  async listDuplicates(agencyId: string, unifiedId: string): Promise<UnifiedCadIncident[]> {
    const canonical = await this.get(agencyId, unifiedId);
    if (!canonical) return [];
    const key = canonical.dedupeKey;
    const matches = await this.findByDedupeKey(agencyId, key);
    return matches.filter((row) => row.unifiedId !== unifiedId || row.isDuplicate);
  }

  async evaluateDedup(incident: UnifiedCadIncident): Promise<DeduplicationResult> {
    const exact = await this.findExact(incident.agencyId, incident.connectorId, incident.vendorIncidentId);
    if (exact) return { action: "skip_exact_duplicate" };
    const key = incident.dedupeKey || CadDeduplicationEngine.buildDedupeKey(incident);
    const cross = (await this.findByDedupeKey(incident.agencyId, key)).find(
      (row) => row.connectorId !== incident.connectorId && !row.isDuplicate,
    );
    if (cross) {
      return { action: "mark_cross_connector_duplicate", canonicalUnifiedId: cross.unifiedId };
    }
    return { action: "insert", incident: { ...incident, dedupeKey: key, isDuplicate: false } };
  }
}

export const cadUnifiedIncidentStore = new CadUnifiedIncidentStore();
