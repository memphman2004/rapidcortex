/**
 * Venue Analytics Service — RFP 2396IP, Build Item 5
 *
 * Aggregates incident counts by status, category, and severity over time
 * buckets. No cross-tenant data ever returned (agencyId filter on every query).
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { VENUE_KEYS } from "./venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

export interface AnalyticsBucket {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface VenueAnalyticsTrend {
  venueCode: string;
  agencyId: string;
  totalIncidents: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byDay: AnalyticsBucket[];
  avgResolutionMinutes: number | null;
  generatedAt: string;
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export async function getVenueAnalyticsTrends(params: {
  agencyId: string;
  venueCode: string;
  fromDate?: string; // ISO date string (inclusive)
  toDate?: string;
}): Promise<VenueAnalyticsTrend> {
  // Query all incidents for venue (paginated via Limit=500 to avoid scan)
  const allItems: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: venueConfigTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "agencyId = :aid",
        ExpressionAttributeValues: {
          ":pk": VENUE_KEYS.incidentPk(params.venueCode),
          ":prefix": "INCIDENT#",
          ":aid": params.agencyId,
        },
        // Exclude nested update/evidence/coc/audit keys
        ScanIndexForward: false,
        Limit: 500,
        ExclusiveStartKey: lastKey,
      }),
    );

    const incidents = (result.Items ?? []).filter((r) => {
      const sk = String(r.sk ?? "");
      // Only top-level INCIDENT#<id> keys (no sub-keys with extra #)
      return /^INCIDENT#[^#]+$/.test(sk);
    });

    allItems.push(...(incidents as Record<string, unknown>[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey && allItems.length < 2000);

  // Apply date filters
  const from = params.fromDate ?? "1970-01-01";
  const to = params.toDate ?? "9999-12-31";
  const filtered = allItems.filter((r) => {
    const d = String(r.createdAt ?? "").slice(0, 10);
    return d >= from && d <= to;
  });

  // Aggregate
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};
  const resolutionMinutes: number[] = [];

  for (const r of filtered) {
    const status = String(r.status ?? "unknown");
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const cat = String(r.category ?? r.type ?? "other");
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;

    const sev = String(r.severity ?? "low");
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;

    const day = dayKey(String(r.createdAt ?? ""));
    byDayMap[day] = (byDayMap[day] ?? 0) + 1;

    if (
      (status === "resolved" || status === "closed") &&
      r.createdAt &&
      r.updatedAt
    ) {
      const created = new Date(String(r.createdAt)).getTime();
      const updated = new Date(String(r.updatedAt)).getTime();
      if (!isNaN(created) && !isNaN(updated) && updated > created) {
        resolutionMinutes.push((updated - created) / 60000);
      }
    }
  }

  const byDay = Object.entries(byDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const avgResolutionMinutes =
    resolutionMinutes.length > 0
      ? Math.round(
          resolutionMinutes.reduce((a, b) => a + b, 0) / resolutionMinutes.length,
        )
      : null;

  return {
    venueCode: params.venueCode,
    agencyId: params.agencyId,
    totalIncidents: filtered.length,
    byStatus,
    byCategory,
    bySeverity,
    byDay,
    avgResolutionMinutes,
    generatedAt: new Date().toISOString(),
  };
}
