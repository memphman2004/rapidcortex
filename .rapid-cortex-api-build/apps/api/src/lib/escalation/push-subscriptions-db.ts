import { createHash } from "node:crypto";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../env.js";

const TTL_SECONDS = 60 * 60 * 24 * 30;

function tableName(): string {
  if (!env.pushSubscriptionsTable) {
    throw new Error("Missing required env var: PUSH_SUBSCRIPTIONS_TABLE");
  }
  return env.pushSubscriptionsTable;
}

export function subscriptionIdFor(agencyId: string, endpoint: string | undefined, userId: string): string {
  const seed = `${agencyId}|${endpoint ?? ""}|${userId}`;
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export async function putPushSubscription(item: {
  agencyId: string;
  subscriptionId: string;
  userId: string;
  endpoint?: string;
  keys?: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<void> {
  const now = Date.now();
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: `AGENCY#${item.agencyId}`,
        sk: `SUB#${item.subscriptionId}`,
        agencyId: item.agencyId,
        userId: item.userId,
        endpoint: item.endpoint ?? "",
        keys: item.keys ?? {},
        userAgent: item.userAgent ?? "",
        createdAt: now,
        ttl: Math.floor(now / 1000) + TTL_SECONDS,
      },
    }),
  );
}

export async function deletePushSubscription(opts: {
  agencyId: string;
  subscriptionId: string;
}): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: {
        pk: `AGENCY#${opts.agencyId}`,
        sk: `SUB#${opts.subscriptionId}`,
      },
    }),
  );
}

export type StoredPushSubscription = {
  pk: string;
  sk: string;
  agencyId: string;
  userId: string;
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
  createdAt: number;
  ttl: number;
};

export async function listPushSubscriptions(agencyId: string): Promise<StoredPushSubscription[]> {
  const items: StoredPushSubscription[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `AGENCY#${agencyId}`,
          ":sk": "SUB#",
        },
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    );
    for (const item of out.Items ?? []) {
      items.push(item as StoredPushSubscription);
    }
    exclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  return items;
}
