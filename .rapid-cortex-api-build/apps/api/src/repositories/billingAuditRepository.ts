import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { BillingAuditEventRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class BillingAuditRepository {
  async append(event: BillingAuditEventRecord): Promise<void> {
    const t = env.billingAuditEventsTable;
    if (!t) return;
    await ddb.send(new PutCommand({ TableName: t, Item: event }));
  }

  async listForAgency(agencyId: string, limit = 100): Promise<BillingAuditEventRecord[]> {
    const t = env.billingAuditEventsTable;
    if (!t) return [];
    const res = await ddb.send(
      new QueryCommand({
        TableName: t,
        IndexName: "agencyId-timestamp-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items as BillingAuditEventRecord[]) ?? [];
  }
}
