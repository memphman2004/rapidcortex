import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type WebhookRecord = {
  webhookId: string;
  agencyId: string;
  targetUrl: string;
  eventTypes: string[];
  status: "active" | "disabled";
  /** AES-GCM ciphertext (base64) for HMAC signing secret */
  signingSecretEnc: string;
  createdAt: string;
  updatedAt: string;
  lastDeliveryAt?: string | null;
  failureCount: number;
};

export class WebhookRepository {
  private table() {
    const n = env.webhooksTable;
    if (!n) throw new Error("WEBHOOKS_TABLE_NOT_CONFIGURED");
    return n;
  }

  async put(r: WebhookRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: r,
      }),
    );
  }

  async get(webhookId: string): Promise<WebhookRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { webhookId },
      }),
    );
    return (out.Item as WebhookRecord | undefined) ?? null;
  }

  async listByAgency(agencyId: string, limit = 100): Promise<WebhookRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as WebhookRecord[];
  }

  async patchDeliveryMeta(
    webhookId: string,
    agencyId: string,
    patch: { lastDeliveryAt: string; failureCount: number },
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { webhookId },
        UpdateExpression: "SET lastDeliveryAt = :l, failureCount = :f, updatedAt = :u",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":l": patch.lastDeliveryAt,
          ":f": patch.failureCount,
          ":u": new Date().toISOString(),
          ":a": agencyId,
        },
      }),
    );
  }

  async updateStatus(webhookId: string, agencyId: string, status: WebhookRecord["status"]): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { webhookId },
        UpdateExpression: "SET #s = :s, updatedAt = :u",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": status,
          ":u": now,
          ":a": agencyId,
        },
      }),
    );
  }
}
