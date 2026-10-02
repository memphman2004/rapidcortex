import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { EmergencyOverrideToken } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type NetworkOverrideRow = {
  userId: string;
  sortKey: string;
  recordType: "token" | "request";
  tokenId: string;
  agencyId: string;
  grantedBy?: string;
  grantedAt: string;
  createdAt?: string;
  expiresAt: string;
  reason: string;
  used: boolean;
  status?: "pending" | "approved" | "rejected";
  ttl: number;
};

export class NetworkEmergencyOverrideRepository {
  private table(): string | null {
    return env.networkEmergencyOverridesTable || null;
  }

  async putToken(token: EmergencyOverrideToken): Promise<void> {
    const t = this.table();
    if (!t) throw new Error("NETWORK_EMERGENCY_OVERRIDES_TABLE not configured");
    const expiresMs = new Date(token.expiresAt).getTime();
    const row: NetworkOverrideRow = {
      userId: token.userId,
      sortKey: `TOKEN#${token.tokenId}`,
      recordType: "token",
      tokenId: token.tokenId,
      agencyId: token.agencyId,
      grantedBy: token.grantedBy,
      grantedAt: token.grantedAt,
      createdAt: token.grantedAt,
      expiresAt: token.expiresAt,
      reason: token.reason,
      used: token.used,
      ttl: Math.floor(expiresMs / 1000),
    };
    await ddb.send(new PutCommand({ TableName: t, Item: row }));
  }

  async findValidToken(userId: string, agencyId: string): Promise<NetworkOverrideRow | null> {
    const t = this.table();
    if (!t) return null;
    const now = new Date().toISOString();
    const res = await ddb.send(
      new QueryCommand({
        TableName: t,
        KeyConditionExpression: "userId = :u AND begins_with(sortKey, :p)",
        ExpressionAttributeValues: {
          ":u": userId,
          ":p": "TOKEN#",
          ":a": agencyId,
          ":now": now,
          ":false": false,
        },
        FilterExpression: "agencyId = :a AND expiresAt > :now AND used = :false",
      }),
    );
    const items = (res.Items ?? []) as NetworkOverrideRow[];
    return items[0] ?? null;
  }

  async markUsed(userId: string, sortKey: string): Promise<void> {
    const t = this.table();
    if (!t) return;
    await ddb.send(
      new UpdateCommand({
        TableName: t,
        Key: { userId, sortKey },
        UpdateExpression: "SET used = :true",
        ExpressionAttributeValues: { ":true": true },
      }),
    );
  }

  async putRequest(row: NetworkOverrideRow): Promise<void> {
    const t = this.table();
    if (!t) throw new Error("NETWORK_EMERGENCY_OVERRIDES_TABLE not configured");
    await ddb.send(new PutCommand({ TableName: t, Item: row }));
  }

  async listPendingForAgency(agencyId: string, limit = 20): Promise<NetworkOverrideRow[]> {
    const t = this.table();
    if (!t) return [];
    const res = await ddb.send(
      new QueryCommand({
        TableName: t,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":pending": "pending",
          ":rt": "request",
        },
        FilterExpression: "recordType = :rt AND #st = :pending",
        ExpressionAttributeNames: { "#st": "status" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as NetworkOverrideRow[];
  }
}
