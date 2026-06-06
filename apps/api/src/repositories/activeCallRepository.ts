import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { ActiveCallRecord, PendingTransfer } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class ActiveCallRepository {
  private table(): string {
    const t = env.activeCallsTable?.trim();
    if (!t) throw new Error("ACTIVE_CALLS_UNAVAILABLE");
    return t;
  }

  async get(agencyId: string, callId: string): Promise<ActiveCallRecord | null> {
    const res = await ddb.send(
      
      new GetCommand({
        TableName: this.table(),
        Key: { callId },
      }),
    );
    const row = res.Item as ActiveCallRecord | undefined;
    if (!row || row.agencyId !== agencyId) return null;
    return row;
  }

  async put(record: ActiveCallRecord): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: { ...record, ttl },
      }),
    );
  }

  async listByAgency(agencyId: string, limit = 50): Promise<ActiveCallRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-updatedAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as ActiveCallRecord[];
  }

  async listForHandler(agencyId: string, handlerUserId: string, limit = 50): Promise<ActiveCallRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-handlerUserId-index",
        KeyConditionExpression: "agencyId = :a AND currentHandlerUserId = :h",
        ExpressionAttributeValues: { ":a": agencyId, ":h": handlerUserId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    const owned = (res.Items ?? []) as ActiveCallRecord[];
    const agencyRows = await this.listByAgency(agencyId, limit);
    const incoming = agencyRows.filter(
      (r) =>
        r.pendingTransfer?.targetUserId === handlerUserId &&
        r.pendingTransfer.status === "pending",
    );
    const byId = new Map<string, ActiveCallRecord>();
    for (const r of [...owned, ...incoming]) byId.set(r.callId, r);
    return [...byId.values()].filter((r) => r.status !== "ended");
  }

  async updatePendingTransfer(
    agencyId: string,
    callId: string,
    pendingTransfer: PendingTransfer | null,
    patch?: Partial<Pick<ActiveCallRecord, "currentHandlerUserId" | "currentHandlerUsername" | "status">>,
  ): Promise<ActiveCallRecord | null> {
    const existing = await this.get(agencyId, callId);
    if (!existing) return null;
    const updatedAt = new Date().toISOString();
    const next: ActiveCallRecord = {
      ...existing,
      ...patch,
      pendingTransfer: pendingTransfer ?? undefined,
      updatedAt,
    };
    await this.put(next);
    return next;
  }
}
