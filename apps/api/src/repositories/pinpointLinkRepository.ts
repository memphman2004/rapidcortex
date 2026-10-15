import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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
  /** browser = QR inline (no SMS); sms = dispatcher-sent link. */
  channel?: "browser" | "sms";
  consentGrantedAt?: string | null;
  smsSentAt?: string | null;
  smsProviderRef?: string | null;
  revokedAt?: string | null;
  revokedReason?: string | null;
  revokedBy?: string | null;
  /** ISO timestamp of last accepted GPS ping (rate-limit + ops). */
  lastPingAt?: string | null;
  ttl: number;
};

export type PinpointRevokeOutcome = "revoked" | "already_ended" | "not_found";

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

  /**
   * Conditionally revoke an active link. Safe under concurrent callers:
   * only one update wins; others observe already_ended.
   */
  async revokeIfActive(
    linkId: string,
    fields: {
      revokedAt: string;
      updatedAt: string;
      revokedReason: string;
      revokedBy: string;
    },
  ): Promise<PinpointRevokeOutcome> {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { linkId },
          ConditionExpression: "attribute_exists(linkId) AND #s = :active",
          UpdateExpression:
            "SET #s = :revoked, revokedAt = :ra, updatedAt = :ua, revokedReason = :rr, revokedBy = :rb",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":active": "active",
            ":revoked": "revoked",
            ":ra": fields.revokedAt,
            ":ua": fields.updatedAt,
            ":rr": fields.revokedReason,
            ":rb": fields.revokedBy,
          },
        }),
      );
      return "revoked";
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "ConditionalCheckFailedException") throw err;
      const row = await this.get(linkId);
      if (!row) return "not_found";
      if (row.status === "revoked" || row.status === "expired") return "already_ended";
      return "not_found";
    }
  }
/**
   * Append a GPS ping only while the session remains active and unexpired.
   * Prevents a concurrent Put of a stale active snapshot from resurrecting a revoked session.
   */
  async appendPingIfActive(
    linkId: string,
    ping: PinpointPing,
    nextPings: PinpointPing[],
    opts: {
      updatedAt: string;
      expiresAtMustBeAfterIso: string;
      rateLimitCutoffIso: string | null;
      /** When set, persist consent if the link has none yet (SMS first share). */
      recordConsentAt?: string | null;
    },
  ): Promise<"accepted" | "session_ended" | "rate_limited" | "not_found"> {
    const rateClause = opts.rateLimitCutoffIso
      ? " AND (attribute_not_exists(lastPingAt) OR lastPingAt <= :cutoff)"
      : "";
    const consentExpr = opts.recordConsentAt
      ? ", consentGrantedAt = if_not_exists(consentGrantedAt, :consent)"
      : "";
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { linkId },
          ConditionExpression:
            `attribute_exists(linkId) AND #s = :active AND expiresAt > :expAfter${rateClause}`,
          UpdateExpression: `SET pings = :pings, updatedAt = :ua, lastPingAt = :ua${consentExpr}`,
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":active": "active",
            ":expAfter": opts.expiresAtMustBeAfterIso,
            ":pings": nextPings,
            ":ua": opts.updatedAt,
            ...(opts.rateLimitCutoffIso ? { ":cutoff": opts.rateLimitCutoffIso } : {}),
            ...(opts.recordConsentAt ? { ":consent": opts.recordConsentAt } : {}),
          },
        }),
      );
      return "accepted";
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "ConditionalCheckFailedException") throw err;
      const row = await this.get(linkId);
      if (!row) return "not_found";
      if (row.status !== "active" || Date.parse(row.expiresAt) <= Date.now()) {
        return "session_ended";
      }
      if (opts.rateLimitCutoffIso && row.lastPingAt && row.lastPingAt > opts.rateLimitCutoffIso) {
        return "rate_limited";
      }
      // Concurrent ping lost the race but session still active — treat as rate/conflict.
      return "rate_limited";
    }
  }
}

