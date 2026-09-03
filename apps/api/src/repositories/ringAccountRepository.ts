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

export type RingOAuthStateItem = {
  state: string;
  codeVerifier: string | null;
};

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

  async saveOAuthState(
    agencyId: string,
    userId: string,
    state: string,
    ttlSeconds: number,
    codeVerifier?: string | null,
  ): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
    const verifier = codeVerifier?.trim() || undefined;
    await ddb.send(
      new PutCommand({
        TableName: accountsTable(),
        Item: {
          agencyId,
          userId: ringOAuthStateUserId(userId),
          state,
          ttl,
          itemType: "ring_oauth_state",
          ...(verifier ? { codeVerifier: verifier } : {}),
        },
      }),
    );
  }

  async getOAuthState(agencyId: string, userId: string): Promise<RingOAuthStateItem | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: accountsTable(),
        Key: { agencyId, userId: ringOAuthStateUserId(userId) },
      }),
    );
    if (!out.Item) return null;
    const state = out.Item.state;
    if (typeof state !== "string") return null;
    const rawVerifier = out.Item.codeVerifier;
    const codeVerifier = typeof rawVerifier === "string" && rawVerifier.trim() ? rawVerifier : null;
    return { state, codeVerifier };
  }

  async deleteOAuthState(agencyId: string, userId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: accountsTable(),
        Key: { agencyId, userId: ringOAuthStateUserId(userId) },
      }),
    );
  }

  async deleteLinkedAccount(agencyId: string, userId: string): Promise<void> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: accountsTable(),
          Key: { agencyId, userId },
          ConditionExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: { ":agencyId": agencyId },
        }),
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "ConditionalCheckFailedException") return;
      throw err;
    }
  }
}
