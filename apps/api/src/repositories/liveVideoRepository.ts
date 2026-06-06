import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { LiveVideoSession } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class LiveVideoRepository {
  private table(): string {
    const t = env.liveVideoSessionsTable;
    if (!t) throw new Error("LIVE_VIDEO_SESSIONS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async createSession(session: LiveVideoSession): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: session,
      }),
    );
  }

  async getBySessionId(sessionId: string): Promise<LiveVideoSession | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { sessionId },
      }),
    );
    return (out.Item as LiveVideoSession | undefined) ?? null;
  }

  async mergeSession(updates: Partial<LiveVideoSession> & { sessionId: string }): Promise<LiveVideoSession> {
    const current = await this.getBySessionId(updates.sessionId);
    if (!current) throw new Error("NOT_FOUND");
    const next: LiveVideoSession = { ...current, ...updates };
    await this.createSession(next);
    return next;
  }

  async getByIncidentId(agencyId: string, incidentId: string): Promise<LiveVideoSession | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-index",
        KeyConditionExpression: "incidentId = :incidentId",
        FilterExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":incidentId": incidentId,
          ":agencyId": agencyId,
        },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    return ((out.Items as LiveVideoSession[] | undefined) ?? [])[0] ?? null;
  }

  async getByCallerTokenHash(callerTokenHash: string): Promise<LiveVideoSession | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "callerTokenHash-index",
        KeyConditionExpression: "callerTokenHash = :callerTokenHash",
        ExpressionAttributeValues: { ":callerTokenHash": callerTokenHash },
        Limit: 1,
      }),
    );
    return ((out.Items as LiveVideoSession[] | undefined) ?? [])[0] ?? null;
  }

  async markActive(sessionId: string, activatedAt: string): Promise<LiveVideoSession> {
    const current = await this.getBySessionId(sessionId);
    if (!current) throw new Error("NOT_FOUND");
    const next: LiveVideoSession = {
      ...current,
      status: "active",
      activatedAt: current.activatedAt ?? activatedAt,
      dispatcherJoinAllowed: true,
    };
    await this.createSession(next);
    return next;
  }

  async updateHeartbeat(args: {
    sessionId: string;
    role: "caller" | "dispatcher";
    heartbeatAt: string;
    offerSdp?: string;
    answerSdp?: string;
    iceCandidate?: string;
  }): Promise<LiveVideoSession> {
    const current = await this.getBySessionId(args.sessionId);
    if (!current) throw new Error("NOT_FOUND");
    const next: LiveVideoSession = {
      ...current,
      lastCallerHeartbeatAt:
        args.role === "caller" ? args.heartbeatAt : (current.lastCallerHeartbeatAt ?? undefined),
      lastDispatcherHeartbeatAt:
        args.role === "dispatcher" ? args.heartbeatAt : (current.lastDispatcherHeartbeatAt ?? undefined),
      offerSdp: args.offerSdp ?? current.offerSdp,
      answerSdp: args.answerSdp ?? current.answerSdp,
      callerIceCandidates:
        args.role === "caller" && args.iceCandidate
          ? [...(current.callerIceCandidates ?? []), args.iceCandidate].slice(-50)
          : (current.callerIceCandidates ?? []),
      dispatcherIceCandidates:
        args.role === "dispatcher" && args.iceCandidate
          ? [...(current.dispatcherIceCandidates ?? []), args.iceCandidate].slice(-50)
          : (current.dispatcherIceCandidates ?? []),
    };
    await this.createSession(next);
    return next;
  }

  async endSession(args: {
    sessionId: string;
    endedAt: string;
    endedBy: "caller" | "dispatcher" | "system";
    endReason: "manual" | "timeout" | "incident_closed" | "disconnect" | "error";
  }): Promise<LiveVideoSession> {
    const current = await this.getBySessionId(args.sessionId);
    if (!current) throw new Error("NOT_FOUND");
    const next: LiveVideoSession = {
      ...current,
      status: "ended",
      endedAt: args.endedAt,
      endedBy: args.endedBy,
      endReason: args.endReason,
    };
    await this.createSession(next);
    return next;
  }

  async expireStaleSessions(agencyId: string, nowIso: string): Promise<number> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    const candidates = (out.Items as LiveVideoSession[] | undefined) ?? [];
    let expiredCount = 0;
    for (const row of candidates) {
      if (row.status === "ended" || row.status === "expired" || row.status === "failed") continue;
      if (Date.parse(row.expiresAt) > Date.parse(nowIso)) continue;
      await this.createSession({
        ...row,
        status: "expired",
        endedAt: nowIso,
        endedBy: "system",
        endReason: "timeout",
      });
      expiredCount += 1;
    }
    return expiredCount;
  }
}
