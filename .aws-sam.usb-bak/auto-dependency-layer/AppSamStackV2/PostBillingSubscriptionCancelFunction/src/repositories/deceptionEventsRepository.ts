import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { DeceptionEvent } from "../handlers/deception/deceptionEvent.js";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type ListDeceptionEventsFilter = {
  riskLevel?: string;
  since?: string;
  limit?: number;
};

export class DeceptionEventsRepository {
  private table(): string {
    const t = env.deceptionEventsTable;
    if (!t) throw new Error("DECEPTION_EVENTS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async listRecent(filter: ListDeceptionEventsFilter): Promise<DeceptionEvent[]> {
    const limit = Math.min(500, Math.max(1, filter.limit ?? 200));
    const expr: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    if (filter.riskLevel && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(filter.riskLevel)) {
      expr.push("#rl = :rl");
      names["#rl"] = "riskLevel";
      values[":rl"] = filter.riskLevel;
    }
    if (filter.since === "24h") {
      const iso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expr.push("createdAt >= :since");
      values[":since"] = iso;
    }
    const res = await ddb.send(
      new ScanCommand({
        TableName: this.table(),
        Limit: limit,
        ...(expr.length
          ? {
              FilterExpression: expr.join(" AND "),
              ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
              ExpressionAttributeValues: values,
            }
          : {}),
      }),
    );
    const rows = (res.Items ?? []) as DeceptionEvent[];
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return rows;
  }
}
