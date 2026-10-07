import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { InviteRecord } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class InviteRepository {
  async put(invite: InviteRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.invitesTable,
        Item: invite,
      }),
    );
  }

  async get(inviteId: string): Promise<InviteRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: env.invitesTable,
        Key: { inviteId },
      }),
    );
    return (res.Item as InviteRecord) ?? null;
  }

  async listByAgency(agencyId: string, limit = 50): Promise<InviteRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: env.invitesTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items as InviteRecord[]) ?? [];
  }

  async updateStatus(
    inviteId: string,
    status: InviteRecord["status"],
    extra: Partial<Pick<InviteRecord, "acceptedAt" | "revokedAt" | "updatedAt">>,
  ): Promise<void> {
    const names: Record<string, string> = { "#s": "status", "#u": "updatedAt" };
    const values: Record<string, unknown> = {
      ":s": status,
      ":u": extra.updatedAt ?? new Date().toISOString(),
    };
    let expr = "SET #s = :s, #u = :u";
    if (extra.acceptedAt) {
      names["#a"] = "acceptedAt";
      values[":a"] = extra.acceptedAt;
      expr += ", #a = :a";
    }
    if (extra.revokedAt) {
      names["#r"] = "revokedAt";
      values[":r"] = extra.revokedAt;
      expr += ", #r = :r";
    }
    await ddb.send(
      new UpdateCommand({
        TableName: env.invitesTable,
        Key: { inviteId },
        UpdateExpression: expr,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }
}
