import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type BillingWebhookEventRecord = {
  eventId: string;
  source: "legacy_external";
  processedAt: string;
  agencyId?: string;
  eventType?: string;
};

export class BillingWebhookEventRepository {
  async markProcessedOnce(record: BillingWebhookEventRecord): Promise<boolean> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.billingWebhookEventsTable,
          Item: record,
          ConditionExpression: "attribute_not_exists(eventId)",
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async get(eventId: string): Promise<BillingWebhookEventRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: env.billingWebhookEventsTable,
        Key: { eventId },
      }),
    );
    return (res.Item as BillingWebhookEventRecord) ?? null;
  }
}

