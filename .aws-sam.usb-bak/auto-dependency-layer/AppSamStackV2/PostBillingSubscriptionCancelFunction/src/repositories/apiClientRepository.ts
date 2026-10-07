import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type ApiClientRecord = {
  clientId: string;
  agencyId: string;
  clientName: string;
  status: "active" | "disabled" | "rotated" | "revoked";
  scopes: string[];
  /** scrypt hash (hex) */
  secretHash: string;
  /** random salt (hex) */
  secretSalt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  allowedIps?: string[] | null;
  rateLimitTier: "standard" | "high" | "enterprise";
  environment: "sandbox" | "production";
};

export class ApiClientRepository {
  private table() {
    const n = env.apiClientsTable;
    if (!n) throw new Error("API_CLIENTS_TABLE_NOT_CONFIGURED");
    return n;
  }

  async put(r: ApiClientRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: r,
      }),
    );
  }

  async get(clientId: string): Promise<ApiClientRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { clientId },
      }),
    );
    return (out.Item as ApiClientRecord | undefined) ?? null;
  }

  /**
   * Oversight dashboards — capped scan across all agencies (**rcsuperadmin tooling only**).
   * TODO(prod): require agency filter or replicate via per-agency GSIs instead of Scan (Section 3.1).
   */
  async scanRecent(limit = 500): Promise<ApiClientRecord[]> {
    const out = await ddb.send(
      new ScanCommand({
        TableName: this.table(),
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as ApiClientRecord[];
  }

  async listByAgency(agencyId: string, limit = 200): Promise<ApiClientRecord[]> {
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
    return (out.Items ?? []) as ApiClientRecord[];
  }

  async updateLastUsed(clientId: string, iso: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { clientId },
        UpdateExpression: "SET lastUsedAt = :t, updatedAt = :t",
        ExpressionAttributeValues: { ":t": iso },
      }),
    );
  }

  async updateStatus(
    clientId: string,
    agencyId: string,
    patch: Partial<Pick<ApiClientRecord, "status" | "secretHash" | "secretSalt" | "updatedAt">>,
  ): Promise<void> {
    const sets: string[] = ["updatedAt = :u"];
    const vals: Record<string, unknown> = { ":u": patch.updatedAt ?? new Date().toISOString() };
    if (patch.status != null) {
      sets.push("#s = :s");
      vals[":s"] = patch.status;
    }
    if (patch.secretHash != null) {
      sets.push("secretHash = :sh");
      vals[":sh"] = patch.secretHash;
    }
    if (patch.secretSalt != null) {
      sets.push("secretSalt = :ss");
      vals[":ss"] = patch.secretSalt;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { clientId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ...vals, ":a": agencyId },
        ...(patch.status != null ? { ExpressionAttributeNames: { "#s": "status" } } : {}),
      }),
    );
  }

  async updateAllowedIps(
    clientId: string,
    agencyId: string,
    allowedIps: string[] | null,
  ): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { clientId },
        UpdateExpression: "SET allowedIps = :i, updatedAt = :u",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":i": allowedIps,
          ":u": now,
          ":a": agencyId,
        },
      }),
    );
  }
}
