import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { RcLiteProgrammaticApiKey } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class RcLiteApiKeyRepository {
  private table() {
    const n = env.rcLiteApiKeysTable;
    if (!n) throw new Error("RC_LITE_API_KEYS_TABLE_NOT_CONFIGURED");
    return n;
  }

  async put(key: RcLiteProgrammaticApiKey): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: key,
      }),
    );
  }

  async getByKeyId(keyId: string): Promise<RcLiteProgrammaticApiKey | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { keyId },
      }),
    );
    return (out.Item as RcLiteProgrammaticApiKey | undefined) ?? null;
  }

  async lookupByHash(keyHash: string): Promise<RcLiteProgrammaticApiKey | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "keyHash-index",
        KeyConditionExpression: "keyHash = :h",
        ExpressionAttributeValues: { ":h": keyHash },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0];
    return (item as RcLiteProgrammaticApiKey | undefined) ?? null;
  }

  async listByAgency(agencyId: string, limit = 200): Promise<RcLiteProgrammaticApiKey[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as RcLiteProgrammaticApiKey[];
  }

  async updateLastUsed(keyId: string, iso: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { keyId },
        UpdateExpression: "SET lastUsedAt = :t",
        ExpressionAttributeValues: { ":t": iso },
      }),
    );
  }

  async revoke(keyId: string, revokedBy: string, iso: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { keyId },
        UpdateExpression: "SET #s = :rev, revokedAt = :t, revokedBy = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":rev": "revoked",
          ":t": iso,
          ":u": revokedBy,
        },
      }),
    );
  }
}
