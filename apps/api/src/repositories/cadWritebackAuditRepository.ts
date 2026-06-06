import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CadWritebackAuditRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class CadWritebackAuditRepository {
  private table(): string {
    const t = env.cadWritebackAuditTable;
    if (!t) throw new Error("CAD_WRITEBACK_AUDIT_UNAVAILABLE");
    return t;
  }

  async create(record: CadWritebackAuditRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  }

  async getById(id: string): Promise<CadWritebackAuditRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { id },
      }),
    );
    return (res.Item as CadWritebackAuditRecord | undefined) ?? null;
  }

  /**
   * Newest first. Optional `status` and `since` (ISO-8601 lower bound for `createdAt`, exclusive of older rows via range).
   */
  async listByAgency(agencyId: string, status?: string, sinceIso?: string): Promise<CadWritebackAuditRecord[]> {
    const expressionAttributeValues: Record<string, unknown> = { ":a": agencyId };
    let keyConditionExpression = "agencyId = :a";
    if (sinceIso) {
      keyConditionExpression += " AND createdAt >= :since";
      expressionAttributeValues[":since"] = sinceIso;
    }
    const st = status?.trim();
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: st ? { ...expressionAttributeValues, ":st": st } : expressionAttributeValues,
        ...(st ?
          {
            FilterExpression: "#st = :st",
            ExpressionAttributeNames: { "#st": "status" },
          }
        : {}),
        ScanIndexForward: false,
        Limit: 200,
      }),
    );
    return (res.Items ?? []) as CadWritebackAuditRecord[];
  }

  async update(id: string, updates: Partial<CadWritebackAuditRecord>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error("NOT_FOUND");
    const next: CadWritebackAuditRecord = { ...existing, ...updates, id: existing.id };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: next,
      }),
    );
  }
}
