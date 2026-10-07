import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { VideoAssistSessionEvent } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type VideoAssistDdbItem = {
  sessionId: string;
  tokenHash: string;
  agencyId: string;
  incidentId: string;
  status: string;
  callerPhoneE164: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  callerLocale?: string;
  allowMicrophone: boolean;
  callerOfferSdp?: string | null;
  dispatcherAnswerSdp?: string | null;
  iceCaller: string[];
  iceDispatcher: string[];
  events: VideoAssistSessionEvent[];
  smsSentAt?: string | null;
  smsProviderRef?: string | null;
  consentAt?: string | null;
  openedAt?: string | null;
  streamStartedAt?: string | null;
  endedAt?: string | null;
  canceledAt?: string | null;
  canceledBySub?: string | null;
  lastError?: string | null;
  publicUrl?: string | null;
};

export class VideoAssistRepository {
  private table(): string {
    const t = env.videoAssistTable;
    if (!t) throw new Error("VIDEO_ASSIST_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(item: VideoAssistDdbItem): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
  }

  async get(sessionId: string): Promise<VideoAssistDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { sessionId },
      }),
    );
    return (r.Item as VideoAssistDdbItem) ?? null;
  }

  async getByTokenHash(tokenHash: string): Promise<VideoAssistDdbItem | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "tokenHash-sessionId-index",
        KeyConditionExpression: "tokenHash = :h",
        ExpressionAttributeValues: { ":h": tokenHash },
        Limit: 1,
      }),
    );
    const items = r.Items as VideoAssistDdbItem[] | undefined;
    return items?.[0] ?? null;
  }

  async listByIncident(incidentId: string, limit = 20): Promise<VideoAssistDdbItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-createdAt-index",
        KeyConditionExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":i": incidentId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (r.Items as VideoAssistDdbItem[]) ?? [];
  }
}
