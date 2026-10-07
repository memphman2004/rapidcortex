import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { ddb } from "../repositories/baseRepository.js";

type BillingAuditDetails = Record<string, unknown> & { agencyId?: string; customerId?: string; invoiceId?: string };

export class BillingAuditService {
  async logBillingAction(
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    details: BillingAuditDetails = {},
  ): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: env.billingAuditLogTable,
        Item: {
          logId: makeId("blog"),
          action,
          entityType,
          entityId,
          userId,
          agencyId: details.agencyId,
          customerId: details.customerId,
          invoiceId: details.invoiceId,
          details,
          timestamp: now,
          createdAt: now,
        },
      }),
    );
  }

  async getBillingAuditTrail(filters: {
    agencyId?: string;
    customerId?: string;
    invoiceId?: string;
    action?: string;
    entityType?: string;
    fromTimestamp?: string;
    toTimestamp?: string;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
    let items: Array<Record<string, unknown>> = [];

    if (filters.invoiceId) {
      const out = await ddb.send(
        new QueryCommand({
          TableName: env.billingAuditLogTable,
          IndexName: "invoiceId-timestamp-index",
          KeyConditionExpression: "invoiceId = :invoiceId",
          ExpressionAttributeValues: { ":invoiceId": filters.invoiceId },
          ScanIndexForward: false,
          Limit: limit * 2,
        }),
      );
      items = (out.Items ?? []) as Array<Record<string, unknown>>;
    } else if (filters.customerId) {
      const out = await ddb.send(
        new QueryCommand({
          TableName: env.billingAuditLogTable,
          IndexName: "customerId-timestamp-index",
          KeyConditionExpression: "customerId = :customerId",
          ExpressionAttributeValues: { ":customerId": filters.customerId },
          ScanIndexForward: false,
          Limit: limit * 2,
        }),
      );
      items = (out.Items ?? []) as Array<Record<string, unknown>>;
    } else {
      const out = await ddb.send(
        new ScanCommand({
          TableName: env.billingAuditLogTable,
          Limit: limit * 4,
        }),
      );
      items = (out.Items ?? []) as Array<Record<string, unknown>>;
    }

    const filtered = items
      .filter((item) => !filters.agencyId || item.agencyId === filters.agencyId)
      .filter((item) => !filters.action || item.action === filters.action)
      .filter((item) => !filters.entityType || item.entityType === filters.entityType)
      .filter((item) => !filters.fromTimestamp || String(item.timestamp ?? "") >= filters.fromTimestamp)
      .filter((item) => !filters.toTimestamp || String(item.timestamp ?? "") <= filters.toTimestamp)
      .sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));

    return filtered.slice(0, limit);
  }
}
