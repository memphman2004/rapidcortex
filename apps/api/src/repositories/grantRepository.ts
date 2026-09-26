import { createHash } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  GrantMatchOutcome,
  GrantMatchRecord,
  GrantRecord,
  LeadVertical,
} from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";

function grantsTable(): string {
  const t = process.env.GRANTS_TABLE?.trim();
  if (!t) throw new Error("GRANTS_TABLE_NOT_CONFIGURED");
  return t;
}

function matchesTable(): string {
  const t = process.env.GRANT_MATCHES_TABLE?.trim();
  if (!t) throw new Error("GRANT_MATCHES_TABLE_NOT_CONFIGURED");
  return t;
}

function runsTable(): string {
  const t = process.env.GRANT_RUNS_TABLE?.trim();
  if (!t) throw new Error("GRANT_RUNS_TABLE_NOT_CONFIGURED");
  return t;
}

export function computeGrantId(opportunityId: string, source: string): string {
  return createHash("sha256").update(`${source}::${opportunityId}`).digest("hex").slice(0, 32);
}

function grantKeys(grantId: string) {
  return { pk: `GRANT#${grantId}`, sk: `GRANT#${grantId}` };
}

export class GrantRepository {
  async putGrant(grant: GrantRecord): Promise<void> {
    const close = grant.closeDate ?? "9999-12-31";
    const relevance = String(grant.relevanceScore).padStart(3, "0");
    await ddb.send(
      new PutCommand({
        TableName: grantsTable(),
        Item: {
          ...grantKeys(grant.grantId),
          ...grant,
          gsi1pk: `SOURCE#${grant.source}`,
          gsi1sk: `CLOSE#${close}#${grant.grantId}`,
          gsi2pk: `TIER#${grant.ncqTierMatch}`,
          gsi2sk: `REL#${relevance}#${grant.grantId}`,
        },
      }),
    );
  }

  async getGrant(grantId: string): Promise<GrantRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: grantsTable(),
        Key: grantKeys(grantId),
      }),
    );
    if (!out.Item) return null;
    const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g1s, gsi2pk: _g2, gsi2sk: _g2s, ...rest } =
      out.Item as GrantRecord & Record<string, unknown>;
    return rest as GrantRecord;
  }

  /** List active grants visible to one vertical only. */
  async listActiveForVertical(vertical: LeadVertical, limit = 200): Promise<GrantRecord[]> {
    // Scan with filter — volume is daily grant ingest, not tenant data. Vertical filter is mandatory.
    const out = await ddb.send(
      new ScanCommand({
        TableName: grantsTable(),
        FilterExpression: "#st = :active AND contains(verticals, :v)",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":active": "active", ":v": vertical },
        Limit: Math.min(Math.max(limit * 3, 50), 500),
      }),
    );
    const items = (out.Items ?? []) as Array<GrantRecord & Record<string, unknown>>;
    return items
      .map(({ pk: _p, sk: _s, gsi1pk: _a, gsi1sk: _b, gsi2pk: _c, gsi2sk: _d, ...g }) => g as GrantRecord)
      .filter((g) => g.verticals?.includes(vertical))
      .slice(0, limit);
  }

  async putMatch(match: GrantMatchRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: matchesTable(),
        Item: {
          pk: `LEAD#${match.leadId}`,
          sk: `GRANT#${match.grantId}`,
          ...match,
          gsi1pk: `VERTICAL#${match.vertical}`,
          gsi1sk: `MATCHED_AT#${match.matchedAt}#${match.grantId}`,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async listMatchesForLead(leadId: string, vertical?: LeadVertical): Promise<GrantMatchRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: matchesTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `LEAD#${leadId}`,
          ":sk": "GRANT#",
        },
      }),
    );
    const items = (out.Items ?? []) as GrantMatchRecord[];
    if (!vertical || vertical === "unknown") return items;
    return items.filter((m) => m.vertical === vertical);
  }

  /** Signal feed / grant feed — one vertical partition only. */
  async listMatchesForVertical(vertical: LeadVertical, limit = 100): Promise<GrantMatchRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: matchesTable(),
        IndexName: "ByVerticalMatchedAt",
        KeyConditionExpression: "gsi1pk = :v",
        ExpressionAttributeValues: { ":v": `VERTICAL#${vertical}` },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as GrantMatchRecord[];
  }

  async updateMatchOutcome(
    leadId: string,
    grantId: string,
    outcome: GrantMatchOutcome,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: matchesTable(),
        Key: { pk: `LEAD#${leadId}`, sk: `GRANT#${grantId}` },
        UpdateExpression: "SET #o = :o, repAcknowledged = :t",
        ExpressionAttributeNames: { "#o": "outcome" },
        ExpressionAttributeValues: { ":o": outcome, ":t": true },
      }),
    );
  }

  async putRun(day: string, source: string, stats: Record<string, unknown>): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: runsTable(),
        Item: {
          pk: `RUN#${day}`,
          sk: `SOURCE#${source}`,
          ...stats,
          completedAt: new Date().toISOString(),
        },
      }),
    );
  }
}
