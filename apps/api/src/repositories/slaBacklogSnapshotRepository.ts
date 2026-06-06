import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { BacklogSnapshot } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class SlaBacklogSnapshotRepository {
  async put(snapshot: BacklogSnapshot): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.slaBacklogSnapshotsTable,
        Item: snapshot,
      }),
    );
  }

  async listSince(agencyId: string, sinceIso: string, limit = 500): Promise<BacklogSnapshot[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.slaBacklogSnapshotsTable,
        KeyConditionExpression: "agencyId = :a AND snapshotAt >= :s",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":s": sinceIso,
        },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );
    return (result.Items as BacklogSnapshot[]) ?? [];
  }

  async getLatest(agencyId: string): Promise<BacklogSnapshot | null> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.slaBacklogSnapshotsTable,
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    return (result.Items?.[0] as BacklogSnapshot) ?? null;
  }
}
