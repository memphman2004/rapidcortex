import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { LinkedRingAccount } from "../lib/ring-integration.js";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

function accountsTable(): string {
  const t = env.ringAccountsTable?.trim();
  if (!t) throw new Error("RING_TABLE_ACCOUNTS_NOT_CONFIGURED");
  return t;
}

export function ringOAuthStateUserId(userId: string): string {
  return `ring-oauth-state#${userId}`;
}

export function isRingOAuthStateUserId(userId: string): boolean {
  return userId.startsWith("ring-oauth-state#");
}

export class RingAccountRepository {
  async getLinkedAccount(agencyId: string, userId: string): Promise<LinkedRingAccount | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: accountsTable(),
        Key: { agencyId, userId },
      }),
    );
    if (!out.Item || isRingOAuthStateUserId(String(out.Item.userId ?? ""))) {
      return null;
    }
    return out.Item as LinkedRingAccount;
  }

  async upsertLinkedAccount(account: LinkedRingAccount): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: accountsTable(),
        Item: account,
      }),
    );
  }

  async updateConnectionStatus(
    agencyId: string,
    userId: string,
    connectionStatus: LinkedRingAccount["connectionStatus"],
    patch: Partial<Pick<LinkedRingAccount, "lastTokenRefreshAt" | "updatedAt" | "secretsManagerTokenKey">>,
  ): Promise<void> {
    const sets = ["connectionStatus = :status", "updatedAt = :updatedAt"];
    const values: Record<string, unknown> = {
      ":status": connectionStatus,
      ":updatedAt": patch.updatedAt ?? new Date().toISOString(),
      ":agencyId": agencyId,
    };
    if (patch.lastTokenRefreshAt !== undefined) {
      sets.push("lastTokenRefreshAt = :lastRefresh");
      values[":lastRefresh"] = patch.lastTokenRefreshAt;
    }
    if (patch.secretsManagerTokenKey !== undefined) {
      sets.push("secretsManagerTokenKey = :secretKey");
      values[":secretKey"] = patch.secretsManagerTokenKey;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: accountsTable(),
        Key: { agencyId, userId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeValues: values,
        ConditionExpression: "agencyId = :agencyId",
      }),
    );
  }

  async saveOAuthState(agencyId: string, userId: string, state: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
    await ddb.send(
      new PutCommand({
        TableName: accountsTable(),
        Item: {
          agencyId,
          userId: ringOAuthStateUserId(userId),
          state,
          ttl,
          itemType: "ring_oauth_state",
        },
      }),
    );
  }

  async getOAuthState(agencyId: string, userId: string): Promise<string | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: accountsTable(),
        Key: { agencyId, userId: ringOAuthStateUserId(userId) },
      }),
    );
    if (!out.Item) return null;
    const state = out.Item.state;
    return typeof state === "string" ? state : null;
  }

  async deleteOAuthState(agencyId: string, userId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: accountsTable(),
        Key: { agencyId, userId: ringOAuthStateUserId(userId) },
      }),
    );
  }
}
