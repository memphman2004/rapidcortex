import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { IncidentMediaRecord } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import { RETENTION_DUE_GSI, RETENTION_GSI_PK, retentionQueryUpperBoundSk } from "../lib/retentionPolicy.js";

export class IncidentMediaRepository {
  private table(): string {
    const t = env.incidentMediaTable;
    if (!t) throw new Error("INCIDENT_MEDIA_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(row: IncidentMediaRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: row,
      }),
    );
  }

  async get(agencyId: string, mediaId: string): Promise<IncidentMediaRecord | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { agencyId, mediaId },
      }),
    );
    return (r.Item as IncidentMediaRecord) ?? null;
  }

  async getByTokenHash(tokenHash: string): Promise<IncidentMediaRecord | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "tokenHash-index",
        KeyConditionExpression: "tokenHash = :h",
        ExpressionAttributeValues: { ":h": tokenHash },
        Limit: 1,
      }),
    );
    const items = r.Items as IncidentMediaRecord[] | undefined;
    return items?.[0] ?? null;
  }

  async listByIncident(agencyId: string, incidentId: string, limit = 40): Promise<IncidentMediaRecord[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-createdAt-index",
        KeyConditionExpression: "incidentId = :i",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":i": incidentId, ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (r.Items as IncidentMediaRecord[]) ?? [];
  }

  async delete(agencyId: string, mediaId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.table(),
        Key: { agencyId, mediaId },
      }),
    );
  }

  async listRetentionDue(
    pageSize: number,
    startKey?: Record<string, unknown>,
  ): Promise<{ items: IncidentMediaRecord[]; lastKey?: Record<string, unknown> }> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: RETENTION_DUE_GSI,
        KeyConditionExpression: "retGsiPk = :p AND retGsiSk <= :max",
        ExpressionAttributeValues: {
          ":p": RETENTION_GSI_PK,
          ":max": retentionQueryUpperBoundSk(),
        },
        Limit: pageSize,
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    return { items: (out.Items as IncidentMediaRecord[]) ?? [], lastKey: out.LastEvaluatedKey };
  }
}
