import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { UsageMeterRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function ymPeriod(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export class UsageMeterRepository {
  aggregateMeterId(agencyId: string, billingPeriod?: string): string {
    const p = billingPeriod ?? ymPeriod();
    return `${agencyId}#${p}`;
  }

  async getAggregate(agencyId: string, billingPeriod?: string): Promise<UsageMeterRecord | null> {
    const t = env.usageMetersTable;
    if (!t) return null;
    const p = billingPeriod ?? ymPeriod();
    const usageMeterId = this.aggregateMeterId(agencyId, p);
    const res = await ddb.send(
      new GetCommand({ TableName: t, Key: { usageMeterId } }),
    );
    return (res.Item as UsageMeterRecord | undefined) ?? null;
  }

  async incrementField(
    agencyId: string,
    billingPeriod: string | undefined,
    field: keyof Pick<
      UsageMeterRecord,
      | "incidentCount"
      | "apiCallCount"
      | "aiSummaryCount"
      | "transcriptionMinutes"
      | "translationMinutes"
      | "mediaSessionCount"
      | "cadExportCount"
      | "webhookDeliveryCount"
      | "failedApiCalls"
    >,
    delta: number,
  ): Promise<void> {
    const t = env.usageMetersTable;
    if (!t || delta === 0) return;
    const p = billingPeriod ?? ymPeriod();
    const usageMeterId = this.aggregateMeterId(agencyId, p);
    const now = new Date().toISOString();

    await ddb.send(
      new UpdateCommand({
        TableName: t,
        Key: { usageMeterId },
        UpdateExpression:
          "SET agencyId=:a, billingPeriod=:p, updatedAt=:u, createdAt=if_not_exists(createdAt,:u) ADD #f :d",
        ExpressionAttributeNames: { "#f": field },
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":p": p,
          ":u": now,
          ":d": delta,
        },
      }),
    );
  }

  async put(m: UsageMeterRecord): Promise<void> {
    const t = env.usageMetersTable;
    if (!t) return;
    await ddb.send(new PutCommand({ TableName: t, Item: m }));
  }

  async queryByAgencyRecent(agencyId: string, limit = 24): Promise<UsageMeterRecord[]> {
    const t = env.usageMetersTable;
    if (!t) return [];
    const res = await ddb.send(
      new QueryCommand({
        TableName: t,
        IndexName: "agencyId-billingPeriod-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items as UsageMeterRecord[]) ?? [];
  }
}
