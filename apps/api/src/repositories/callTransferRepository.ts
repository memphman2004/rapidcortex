import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CallTransferMethod, CallTransferStatus } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type CallTransferRecord = {
  transferId: string;
  agencyId: string;
  callId: string;
  method: CallTransferMethod;
  action: "transfer" | "takeover";
  status: CallTransferStatus;
  initiatedBy: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  reason?: string;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
};

export class CallTransferRepository {
  private table(): string {
    const t = env.callTransfersTable?.trim();
    if (!t) throw new Error("CALL_TRANSFERS_UNAVAILABLE");
    return t;
  }

  async create(record: CallTransferRecord): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: { ...record, ttl },
      }),
    );
  }

  async listByCall(agencyId: string, callId: string, limit = 20): Promise<CallTransferRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "callId-initiatedAt-index",
        KeyConditionExpression: "callId = :c",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":c": callId, ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as CallTransferRecord[];
  }
}
