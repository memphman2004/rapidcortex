import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { RapidIqSignal } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.rapidIqSignalsTable;
  if (!t) throw new Error("RAPID_IQ_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

export class RapidIqSignalRepository {
  async put(signal: RapidIqSignal): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: signal }));
  }

  async listByOpportunity(opportunityId: string): Promise<RapidIqSignal[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "opportunityId-published-index",
        KeyConditionExpression: "opportunityId = :o",
        ExpressionAttributeValues: { ":o": opportunityId },
        ScanIndexForward: false,
      }),
    );
    return (r.Items as RapidIqSignal[]) ?? [];
  }

  async listAll(): Promise<RapidIqSignal[]> {
    const items: RapidIqSignal[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(new ScanCommand({ TableName: table(), ExclusiveStartKey }));
      items.push(...((r.Items as RapidIqSignal[]) ?? []));
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items;
  }
}
