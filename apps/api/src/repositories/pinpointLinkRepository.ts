import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { PinpointPing } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type PinpointLinkDdbItem = {
  linkId: string;
  tokenHash: string;
  agencyId: string;
  incidentId: string;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  pings: PinpointPing[];
  callerPhoneE164: string;
  smsSentAt?: string | null;
  smsProviderRef?: string | null;
  revokedAt?: string | null;
  ttl: number;
};

export class PinpointLinkRepository {
  private table(): string {
    const t = env.pinpointLinksTable;
    if (!t) throw new Error("PINPOINT_LINKS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(item: PinpointLinkDdbItem): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
  }

  async get(linkId: string): Promise<PinpointLinkDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { linkId },
      }),
    );
    const item = r.Item as PinpointLinkDdbItem | undefined;
    return item ?? null;
  }

  async getByTokenHash(tokenHash: string): Promise<PinpointLinkDdbItem | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "tokenHash-linkId-index",
        KeyConditionExpression: "tokenHash = :h",
        ExpressionAttributeValues: { ":h": tokenHash },
        Limit: 1,
      }),
    );
    const items = r.Items as PinpointLinkDdbItem[] | undefined;
    return items?.[0] ?? null;
  }

  async listByIncident(incidentId: string, agencyId: string, limit = 50): Promise<PinpointLinkDdbItem[]> {
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
    const items = (r.Items as PinpointLinkDdbItem[]) ?? [];
    return items.filter((x) => x.agencyId === agencyId);
  }
}
