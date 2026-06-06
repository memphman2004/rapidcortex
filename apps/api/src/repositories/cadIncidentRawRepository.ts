import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { CadIncidentStatus, CadPriority } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type CadIncidentRawStatus =
  | "received"
  | "queued"
  | "processing"
  | "ok"
  | "error"
  | "rate_limited"
  | "unauthorized"
  | "duplicate_skip";

export type CadIncidentRawRecord = {
  id: string;
  agencyId: string;
  integrationId: string;
  receivedAt: string;
  rawBody: string;
  /** Inbound Content-Type when stored (XML vs JSON detection on async replay). */
  contentType?: string;
  status: CadIncidentRawStatus;
  errorMessage?: string;
  linkedIncidentId?: string;
  ttl: number;
  /** Internal self-test marker (never trust from public webhook). */
  internalSelfTest?: boolean;
};

export class CadIncidentRawRepository {
  private table(): string {
    const t = env.cadIncidentsRawTable;
    if (!t) throw new Error("CAD_INCIDENTS_RAW_UNAVAILABLE");
    return t;
  }

  async put(record: CadIncidentRawRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
      }),
    );
  }

  /** Idempotent raw receipt: same `id` is only inserted once (duplicate webhook / revision replay). */
  async putIfAbsent(record: CadIncidentRawRecord): Promise<{ inserted: boolean }> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: this.table(),
          Item: record,
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
      return { inserted: true };
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "ConditionalCheckFailedException") return { inserted: false };
      throw e;
    }
  }

  async get(id: string): Promise<CadIncidentRawRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { id },
      }),
    );
    return (res.Item as CadIncidentRawRecord | undefined) ?? null;
  }

  async updateStatus(
    id: string,
    fields: Partial<Pick<CadIncidentRawRecord, "status" | "errorMessage" | "linkedIncidentId">>,
  ): Promise<void> {
    const sets = ["#st = :st"];
    const names: Record<string, string> = { "#st": "status" };
    const vals: Record<string, unknown> = { ":st": fields.status };
    if (fields.errorMessage !== undefined) {
      sets.push("errorMessage = :em");
      vals[":em"] = fields.errorMessage;
    }
    if (fields.linkedIncidentId !== undefined) {
      sets.push("linkedIncidentId = :li");
      vals[":li"] = fields.linkedIncidentId;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { id },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: vals,
      }),
    );
  }

  async listByAgency(
    agencyId: string,
    opts: { status?: CadIncidentStatus; priority?: CadPriority; from?: string; to?: string; limit?: number },
  ): Promise<CadIncidentRawRecord[]> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-receivedAt-index",
        KeyConditionExpression:
          opts.from && opts.to ?
            "agencyId = :a AND receivedAt BETWEEN :f AND :t"
          : opts.from ?
            "agencyId = :a AND receivedAt >= :f"
          : "agencyId = :a",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ...(opts.from ? { ":f": opts.from } : {}),
          ...(opts.to ? { ":t": opts.to } : {}),
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    let rows = (res.Items ?? []) as CadIncidentRawRecord[];
    return rows;
  }

  async listByIntegration(
    agencyId: string,
    integrationId: string,
    opts: { from?: string; limit?: number },
  ): Promise<CadIncidentRawRecord[]> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "integrationId-receivedAt-index",
        KeyConditionExpression: opts.from ? "integrationId = :i AND receivedAt >= :f" : "integrationId = :i",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":i": integrationId,
          ":a": agencyId,
          ...(opts.from ? { ":f": opts.from } : {}),
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as CadIncidentRawRecord[];
  }
}
