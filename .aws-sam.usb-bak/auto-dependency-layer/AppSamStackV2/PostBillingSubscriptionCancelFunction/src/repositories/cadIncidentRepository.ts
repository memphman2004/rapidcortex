import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CadIncidentStatus, CadPriority } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type CadIncidentRecord = {
  id: string;
  agencyId: string;
  cadNumber: string;
  integrationId: string;
  status: CadIncidentStatus;
  priority: CadPriority;
  incidentType: string;
  location: string;
  callerCallback: string;
  callerName: string;
  units: string[];
  rawPayload: string;
  receivedAt: string;
  updatedAt: string;
  ttl: number;
};

export class CadIncidentRepository {
  private table(): string {
    const t = env.cadIncidentsTable;
    if (!t) throw new Error("CAD_INCIDENTS_UNAVAILABLE");
    return t;
  }

  async put(record: CadIncidentRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
      }),
    );
  }

  async listByAgency(
    agencyId: string,
    opts: { status?: CadIncidentStatus; priority?: CadPriority; from?: string; to?: string; limit?: number },
  ): Promise<CadIncidentRecord[]> {
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
    let rows = (res.Items ?? []) as CadIncidentRecord[];
    if (opts.status) rows = rows.filter((r) => r.status === opts.status);
    if (opts.priority) rows = rows.filter((r) => r.priority === opts.priority);
    return rows;
  }
}
