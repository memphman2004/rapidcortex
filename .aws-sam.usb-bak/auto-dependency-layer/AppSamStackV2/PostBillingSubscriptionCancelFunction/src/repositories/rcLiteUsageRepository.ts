import { GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { RcLiteKeyTier } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type RcLiteUsageRow = {
  usageKey: string;
  keyId: string;
  agencyId: string;
  customerId: string;
  yearMonth: string;
  totalCalls: number;
  overageCalls: number;
  monthlyCallLimit: number;
  tier: RcLiteKeyTier;
  lastUpdatedAt: string;
};

export class RcLiteUsageRepository {
  private table() {
    const n = env.rcLiteUsageTable;
    if (!n) throw new Error("RC_LITE_USAGE_TABLE_NOT_CONFIGURED");
    return n;
  }

  /** Cross-tenant RC Admin rollup for a billing month (scan + filter). */
  async listByYearMonth(yearMonth: string, limit = 500): Promise<RcLiteUsageRow[]> {
    const items: RcLiteUsageRow[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const out = await ddb.send(
        new ScanCommand({
          TableName: this.table(),
          FilterExpression: "yearMonth = :ym",
          ExpressionAttributeValues: { ":ym": yearMonth },
          ExclusiveStartKey: lastKey,
          Limit: Math.min(limit - items.length, 100),
        }),
      );
      items.push(...((out.Items ?? []) as RcLiteUsageRow[]));
      lastKey = out.LastEvaluatedKey;
    } while (lastKey && items.length < limit);
    return items;
  }

  async get(usageKey: string): Promise<RcLiteUsageRow | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { usageKey },
      }),
    );
    return (out.Item as RcLiteUsageRow | undefined) ?? null;
  }

  /**
   * Fire-and-forget safe: increments totals and aligns overage snapshot.
   */
  async incrementSuccessCall(params: {
    usageKey: string;
    keyId: string;
    agencyId: string;
    customerId: string;
    yearMonth: string;
    monthlyCallLimit: number;
    tier: RcLiteKeyTier;
  }): Promise<void> {
    const now = new Date().toISOString();
    const out = await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { usageKey: params.usageKey },
        UpdateExpression:
          "ADD totalCalls :one SET keyId = if_not_exists(keyId, :kid), agencyId = if_not_exists(agencyId, :aid), customerId = if_not_exists(customerId, :cid), yearMonth = if_not_exists(yearMonth, :ym), monthlyCallLimit = if_not_exists(monthlyCallLimit, :ml), tier = if_not_exists(tier, :tier), lastUpdatedAt = :now",
        ExpressionAttributeValues: {
          ":one": 1,
          ":kid": params.keyId,
          ":aid": params.agencyId,
          ":cid": params.customerId,
          ":ym": params.yearMonth,
          ":ml": params.monthlyCallLimit,
          ":tier": params.tier,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    const total = Number(out.Attributes?.totalCalls ?? 0);
    const limit = Number(out.Attributes?.monthlyCallLimit ?? params.monthlyCallLimit);
    const over = Math.max(0, total - limit);
    const prevOver = Number(out.Attributes?.overageCalls ?? 0);
    if (over !== prevOver) {
      await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { usageKey: params.usageKey },
          UpdateExpression: "SET overageCalls = :o, lastUpdatedAt = :now",
          ExpressionAttributeValues: { ":o": over, ":now": now },
        }),
      );
    }
  }
}
