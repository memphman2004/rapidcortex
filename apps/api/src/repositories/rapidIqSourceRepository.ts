import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { RapidIqSource } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.rapidIqSourcesTable;
  if (!t) throw new Error("RAPID_IQ_SOURCES_TABLE_NOT_CONFIGURED");
  return t;
}

export class RapidIqSourceRepository {
  async put(source: RapidIqSource): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: source }));
  }

  async listByOpportunity(opportunityId: string): Promise<RapidIqSource[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "opportunityId-index",
        KeyConditionExpression: "opportunityId = :o",
        ExpressionAttributeValues: { ":o": opportunityId },
      }),
    );
    return (r.Items as RapidIqSource[]) ?? [];
  }
}
