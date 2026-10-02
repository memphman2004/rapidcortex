import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { SilentTextMessage, SilentTextSessionEvent } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type SilentTextDdbItem = {
  sessionId: string;
  tokenHash: string;
  agencyId: string;
  incidentId: string;
  status: string;
  callerPhoneE164: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  callerLocale?: string;
  stealthAppearance: boolean;
  highRisk: boolean;
  messages: SilentTextMessage[];
  events: SilentTextSessionEvent[];
  smsSentAt?: string | null;
  smsProviderRef?: string | null;
  openedAt?: string | null;
  endedAt?: string | null;
  canceledAt?: string | null;
  closedBySub?: string | null;
  lastError?: string | null;
  publicUrl?: string | null;
  lastCallerPresenceAt?: string | null;
  lastDispatcherPresenceAt?: string | null;
};

/**
 * Multi-tenant scoping note: the table's primary key is `sessionId`, so authenticated reads pass
 * `agencyId` and we drop the row if it does not match. The public-token paths look up by the
 * hashed opaque token (which itself is the per-tenant authenticator) and do not require a separate
 * agencyId filter — leakage requires a hash collision, not a sessionId collision.
 */
export class SilentTextRepository {
  private table(): string {
    const t = env.silentTextTable;
    if (!t) throw new Error("SILENT_TEXT_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(item: SilentTextDdbItem): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
  }

  /**
   * Authenticated dispatcher fetch. Always scope by `agencyId` — if a sessionId collision occurred
   * across tenants we must not return the foreign row to the caller.
   */
  async get(sessionId: string, agencyId: string): Promise<SilentTextDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { sessionId },
      }),
    );
    const item = (r.Item as SilentTextDdbItem | undefined) ?? null;
    if (!item) return null;
    if (item.agencyId !== agencyId) return null;
    return item;
  }

  /**
   * Public-token flow. No bearer auth — caller proves access by presenting the opaque token that
   * hashes to this row. Returns the row verbatim so the public handler can decide based on
   * `expiresAt`/`endedAt`/`canceledAt`.
   */
  async getByTokenHash(tokenHash: string): Promise<SilentTextDdbItem | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "tokenHash-sessionId-index",
        KeyConditionExpression: "tokenHash = :h",
        ExpressionAttributeValues: { ":h": tokenHash },
        Limit: 1,
      }),
    );
    const items = r.Items as SilentTextDdbItem[] | undefined;
    return items?.[0] ?? null;
  }

  async listByIncident(
    incidentId: string,
    agencyId: string,
    limit = 25,
  ): Promise<SilentTextDdbItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-createdAt-index",
        KeyConditionExpression: "incidentId = :i",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":i": incidentId, ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (r.Items as SilentTextDdbItem[]) ?? [];
  }
}
