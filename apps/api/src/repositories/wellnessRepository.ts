import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { TraumaFlagRecord } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class WellnessRepository {
  private table(): string {
    const t = env.traumaFlagsTable;
    if (!t) throw new Error("WELLNESS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async create(row: TraumaFlagRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: row,
      }),
    );
  }

  async listOpenByIncidentSince(incidentId: string, sinceIso: string): Promise<TraumaFlagRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-createdAt-index",
        KeyConditionExpression: "incidentId = :i AND createdAt >= :since",
        ExpressionAttributeValues: {
          ":i": incidentId,
          ":since": sinceIso,
        },
        ScanIndexForward: false,
      }),
    );
    return ((res.Items ?? []) as TraumaFlagRecord[]).filter((r) => r.status === "open");
  }

  async listByAgency(agencyId: string, limit = 100): Promise<TraumaFlagRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as TraumaFlagRecord[];
  }

  /** Prior trauma flags tied to the same normalized caller address (newest first). */
  async listByAgencyCallerAddressKey(
    agencyId: string,
    callerAddressNormalized: string,
    limit = 200,
  ): Promise<TraumaFlagRecord[]> {
    const key = `${agencyId}#${callerAddressNormalized}`;
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyCallerAddressKey-createdAt-index",
        KeyConditionExpression: "agencyCallerAddressKey = :k",
        ExpressionAttributeValues: { ":k": key },
        ScanIndexForward: false,
        Limit: Math.min(limit, 500),
      }),
    );
    const rows = (res.Items ?? []) as TraumaFlagRecord[];
    return rows.filter((r) => r.agencyId === agencyId);
  }

  async acknowledge(flagId: string, agencyId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { flagId },
        UpdateExpression:
          "SET #s = :s, acknowledgedAt = :a, acknowledgedByUserId = :u",
        ConditionExpression: "agencyId = :ag",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": "acknowledged",
          ":a": now,
          ":u": userId,
          ":ag": agencyId,
        },
      }),
    );
  }
}
