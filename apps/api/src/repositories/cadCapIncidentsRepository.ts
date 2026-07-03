import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";
import type { CadCapRecord, CapIngestStatus } from "../lib/cad/cap/cap-types.js";

export class CadCapIncidentsRepository {
  private table(): string {
    const t = env.cadCapIncidentsTable?.trim();
    if (!t) throw new Error("CAD_CAP_INCIDENTS_UNAVAILABLE");
    return t;
  }

  async listByAgency(
    agencyId: string,
    opts?: { status?: CapIngestStatus; limit?: number },
  ): Promise<CadCapRecord[]> {
    const limit = opts?.limit ?? 50;
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    let items = (res.Items ?? []) as CadCapRecord[];
    if (opts?.status) {
      items = items.filter((row) => row.status === opts.status);
    }
    return items;
  }
}
