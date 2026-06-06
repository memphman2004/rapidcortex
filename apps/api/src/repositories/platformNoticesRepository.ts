import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { PlatformNotice } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function noticesTable(): string {
  const t = process.env.PLATFORM_NOTICES_TABLE?.trim();
  if (!t) throw new Error("PLATFORM_NOTICES_TABLE not set");
  return t;
}

function acksTable(): string {
  const t = process.env.PLATFORM_NOTICE_ACKS_TABLE?.trim();
  if (!t) throw new Error("PLATFORM_NOTICE_ACKS_TABLE not set");
  return t;
}

export class PlatformNoticesRepository {
  async put(notice: PlatformNotice): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: noticesTable(),
        Item: notice,
      }),
    );
  }

  async get(noticeId: string): Promise<PlatformNotice | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: noticesTable(),
        Key: { noticeId },
      }),
    );
    return (result.Item as PlatformNotice) ?? null;
  }

  async listActive(opts?: {
    targetType?: PlatformNotice["targetType"];
    limit?: number;
  }): Promise<PlatformNotice[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const limit = opts?.limit ?? 100;

    if (opts?.targetType) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: noticesTable(),
          IndexName: "targetType-createdAt-index",
          KeyConditionExpression: "targetType = :tt",
          ExpressionAttributeValues: { ":tt": opts.targetType },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      return ((result.Items ?? []) as PlatformNotice[]).filter((n) => n.expiresAt > nowSec);
    }

    const types: PlatformNotice["targetType"][] = ["all", "vertical", "agency"];
    const merged: PlatformNotice[] = [];
    for (const targetType of types) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: noticesTable(),
          IndexName: "targetType-createdAt-index",
          KeyConditionExpression: "targetType = :tt",
          ExpressionAttributeValues: { ":tt": targetType },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      merged.push(...((result.Items ?? []) as PlatformNotice[]));
    }

    const seen = new Set<string>();
    return merged
      .filter((n) => n.expiresAt > nowSec)
      .filter((n) => {
        if (seen.has(n.noticeId)) return false;
        seen.add(n.noticeId);
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async expireNow(noticeId: string): Promise<PlatformNotice | null> {
    const existing = await this.get(noticeId);
    if (!existing) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const nowIso = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: noticesTable(),
        Key: { noticeId },
        UpdateExpression: "SET expiresAt = :exp, expiresAtIso = :iso",
        ExpressionAttributeValues: {
          ":exp": nowSec,
          ":iso": nowIso,
        },
      }),
    );
    return { ...existing, expiresAt: nowSec, expiresAtIso: nowIso };
  }

  async recordAck(noticeId: string, userId: string, agencyId: string): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: acksTable(),
        Item: {
          noticeId,
          userId,
          agencyId,
          ackedAt: now,
        },
        ConditionExpression: "attribute_not_exists(noticeId) AND attribute_not_exists(userId)",
      }),
    );
  }

  async hasAck(noticeId: string, userId: string): Promise<boolean> {
    const result = await ddb.send(
      new GetCommand({
        TableName: acksTable(),
        Key: { noticeId, userId },
      }),
    );
    return Boolean(result.Item);
  }
}
