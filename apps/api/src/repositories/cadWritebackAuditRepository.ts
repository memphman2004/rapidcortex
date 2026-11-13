import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

  /**
   * Atomically updates a write-back audit record.
   *
   * Uses a conditional write so that only a record currently in
   * `"pending_approval"` can be transitioned.  Any concurrent attempt to
   * approve or reject the same record after the first succeeds will receive a
   * `ConditionalCheckFailedException` from DynamoDB, which is re-thrown as
   * `Error("ALREADY_PROCESSED")` for the handler layer to map to HTTP 409.
   *
   * The `status` field is always routed through the `#st` alias (the same
   * alias used in the ConditionExpression) to avoid duplicate
   * ExpressionAttributeNames entries that would trigger an SDK validation
   * error.
   */
  async update(id: string, updates: Partial<CadWritebackAuditRecord>): Promise<void> {
    // #st is shared between ConditionExpression and the SET clause when
    // `status` appears in `updates`.  All other keys get a #f_<key> alias.
    const names: Record<string, string> = { "#st": "status" };
    const values: Record<string, unknown> = { ":pending": "pending_approval" };
    const setParts: string[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (key === "id") continue; // never overwrite PK

      if (key === "status") {
        // Reuse the #st alias already declared for ConditionExpression —
        // avoids a duplicate-alias SDK validation error.
        values[":v_status"] = val;
        setParts.push("#st = :v_status");
        continue;
      }

      const nameAlias = `#f_${key}`;
      const valAlias = `:v_${key}`;
      names[nameAlias] = key;
      values[valAlias] = val;
      setParts.push(`${nameAlias} = ${valAlias}`);
    }

    if (setParts.length === 0) return;

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { id },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          // Only proceed if the record is still awaiting review.  Throws
          // ConditionalCheckFailedException if already approved / rejected.
          ConditionExpression: "#st = :pending",
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        throw new Error("ALREADY_PROCESSED");
      }
      throw err;
    }
  }
}
