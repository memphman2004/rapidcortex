import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { AccessOverrideRecord } from "../types/accessOverride.js";

export class AccessOverrideRepository {
  private table() {
    const name = env.accessOverridesTable;
    if (!name) throw new Error("ACCESS_OVERRIDES_TABLE_NOT_CONFIGURED");
    return name;
  }

  async put(record: AccessOverrideRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
      }),
    );
  }

  async get(overrideId: string): Promise<AccessOverrideRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { overrideId },
      }),
    );
    return (out.Item as AccessOverrideRecord | undefined) ?? null;
  }

  async queryByAgency(agencyId: string, limit = 500): Promise<AccessOverrideRecord[]> {
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
    return (out.Items ?? []) as AccessOverrideRecord[];
  }

  async queryByAgencyAndTargetUser(
    agencyId: string,
    targetUserId: string,
    limit = 200,
  ): Promise<AccessOverrideRecord[]> {
    const prefix = `${targetUserId}#`;
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-targetUserKey-index",
        KeyConditionExpression:
          "agencyId = :a AND begins_with(targetUserKey, :prefix)",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":prefix": prefix,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as AccessOverrideRecord[];
  }

  async updateRevoked(
    overrideId: string,
    patch: {
      status: "revoked";
      revokedByUserId: string;
      revokedAt: string;
      revokeReason: string;
      updatedAt: string;
    },
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { overrideId },
        UpdateExpression:
          "SET #s = :s, revokedByUserId = :rb, revokedAt = :ra, revokeReason = :rr, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": patch.status,
          ":rb": patch.revokedByUserId,
          ":ra": patch.revokedAt,
          ":rr": patch.revokeReason,
          ":u": patch.updatedAt,
        },
      }),
    );
  }
}
