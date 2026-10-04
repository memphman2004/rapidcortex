import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AttributeValue, DynamoDBRecord, EventBridgeEvent } from "aws-lambda";
import type { IQVertical } from "../../lib/iq-reporting-ddb.js";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient(process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {}),
  { marshallOptions: { removeUndefinedValues: true } },
);

export function analyticsDailyKeys(agencyId: string, vertical: IQVertical, date: string) {
  return {
    pk: `AGENCY#${agencyId}#VERTICAL#${vertical}`,
    sk: `DATE#${date}`,
  };
}

export function deriveVerticalFromSource(source: string | undefined): IQVertical {
  const s = (source ?? "").toLowerCase();
  if (s.includes("campus")) return "campus";
  if (s.includes("venue")) return "venue";
  if (s.includes("transit")) return "transit";
  if (s.includes("hospital")) return "hospital";
  return "911";
}

export function verticalFromAgencyType(raw: string | undefined): IQVertical {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "venue") return "venue";
  if (t === "campus") return "campus";
  if (t === "transit") return "transit";
  if (t === "hospital") return "hospital";
  return "911";
}

export function utcDateString(now: Date, offsetDays: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

/** Nightly default 7 UTC days (today inclusive). Hourly schedule passes `{ backfillDays: 1 }`. */
export function parseBackfillDays(event: unknown): number {
  if (!event || typeof event !== "object") return 7;
  const rec = event as Record<string, unknown>;
  const fromDetail =
    rec.detail && typeof rec.detail === "object"
      ? Number((rec.detail as Record<string, unknown>).backfillDays)
      : Number.NaN;
  const n = Number(rec.backfillDays ?? fromDetail);
  if (!Number.isFinite(n)) return 7;
  return Math.min(30, Math.max(1, Math.floor(n)));
}

function ttlTwoYears(): number {
  return Math.floor(Date.now() / 1000) + 730 * 24 * 60 * 60;
}

function countMetricKey(vertical: IQVertical): string {
  switch (vertical) {
    case "campus":
      return "total_reports";
    case "venue":
      return "guest_reports";
    case "transit":
      return "passenger_reports";
    case "hospital":
      return "ems_pre_alerts";
    default:
      return "calls_911";
  }
}

/**
 * Incremental ADD for a single metric + hourly map (DynamoDB stream path).
 */
export async function incrementDailyMetric(input: {
  agencyId: string;
  vertical: IQVertical;
  date: string;
  hourUtc: number;
  metricKey: string;
  amount?: number;
}): Promise<void> {
  const table = process.env.ANALYTICS_DAILY_TABLE?.trim();
  if (!table || !input.agencyId) return;
  const hour = Math.min(23, Math.max(0, Math.floor(input.hourUtc)));
  const amount = input.amount ?? 1;
  const { pk, sk } = analyticsDailyKeys(input.agencyId, input.vertical, input.date);
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { pk, sk },
      UpdateExpression:
        "ADD metrics.#k :one, hourly.#h :one SET agencyId = if_not_exists(agencyId, :a), vertical = if_not_exists(vertical, :v), #d = if_not_exists(#d, :d), updatedAt = :now, ttl = :ttl",
      ExpressionAttributeNames: { "#k": input.metricKey, "#h": String(hour), "#d": "date" },
      ExpressionAttributeValues: {
        ":one": amount,
        ":a": input.agencyId,
        ":v": input.vertical,
        ":d": input.date,
        ":now": new Date().toISOString(),
        ":ttl": ttlTwoYears(),
      },
    }),
  );
}

type StreamLike = { Records?: DynamoDBRecord[] };

function unmarshallPartial(image: Record<string, AttributeValue> | undefined): Record<string, unknown> {
  if (!image) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(image)) {
    if (!v || typeof v !== "object") continue;
    if ("S" in v && v.S) out[k] = v.S;
    else if ("N" in v && v.N) out[k] = Number(v.N);
  }
  return out;
}

async function handleStream(event: StreamLike): Promise<void> {
  for (const rec of event.Records ?? []) {
    if (rec.eventName !== "INSERT" && rec.eventName !== "MODIFY") continue;
    const image = unmarshallPartial(rec.dynamodb?.NewImage);
    const agencyId = String(image.agencyId ?? "").trim();
    const createdAt = String(image.createdAt ?? image.timestamp ?? "");
    if (!agencyId || createdAt.length < 10) continue;
    const date = createdAt.slice(0, 10);
    const hour = new Date(createdAt).getUTCHours();
    const sourceArn = rec.eventSourceARN ?? "";
    const vertical = deriveVerticalFromSource(sourceArn);
    const metricKey = sourceArn.toLowerCase().includes("language")
      ? "translation_sessions"
      : sourceArn.toLowerCase().includes("qa")
        ? "avg_qa_score"
        : countMetricKey(vertical);
    try {
      await incrementDailyMetric({ agencyId, vertical, date, hourUtc: hour, metricKey });
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "analytics_aggregator_stream_skip",
          userId: "system:analytics-aggregator",
          error: err instanceof Error ? err.message : "unknown",
        }),
      );
    }
  }
}

async function listAgencyRows(): Promise<{ agencyId: string; type: string }[]> {
  const table = process.env.AGENCIES_TABLE?.trim();
  if (!table) return [];
  const rows: { agencyId: string; type: string }[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: table,
        ProjectionExpression: "agencyId, #t, agencyType, vertical",
        ExpressionAttributeNames: { "#t": "type" },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const agencyId = typeof item.agencyId === "string" ? item.agencyId : "";
      if (!agencyId) continue;
      const type =
        (typeof item.vertical === "string" && item.vertical) ||
        (typeof item.agencyType === "string" && item.agencyType) ||
        (typeof item.type === "string" && item.type) ||
        "";
      rows.push({ agencyId, type });
    }
    exclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  return rows;
}

async function recountIncidentsForDay(
  agencyId: string,
  vertical: IQVertical,
  date: string,
): Promise<{ metrics: Record<string, number>; hourly: Record<string, number>; hourlyBuckets: number[] }> {
  const table = process.env.INCIDENTS_TABLE?.trim();
  const metrics: Record<string, number> = {};
  const hourlyBuckets = Array.from({ length: 24 }, () => 0);
  if (!table) {
    return { metrics, hourly: {}, hourlyBuckets };
  }
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  let exclusiveStartKey: Record<string, unknown> | undefined;
  const countKey = countMetricKey(vertical);
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a AND createdAt BETWEEN :from AND :to",
        ExpressionAttributeValues: { ":a": agencyId, ":from": from, ":to": to },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      metrics[countKey] = (metrics[countKey] ?? 0) + 1;
      if (vertical === "911" && (item.cadIncidentId || item.cadId)) {
        metrics.cad_calls_for_service = (metrics.cad_calls_for_service ?? 0) + 1;
      }
      const createdAt = String(item.createdAt ?? "");
      const hour = createdAt ? new Date(createdAt).getUTCHours() : 0;
      if (hour >= 0 && hour < 24) hourlyBuckets[hour] += 1;
    }
    exclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  const hourly: Record<string, number> = {};
  hourlyBuckets.forEach((n, i) => {
    if (n) hourly[String(i)] = n;
  });
  return { metrics, hourly, hourlyBuckets };
}

async function handleNightly(backfillDays: number): Promise<void> {
  const table = process.env.ANALYTICS_DAILY_TABLE?.trim();
  if (!table) {
    console.warn(JSON.stringify({ msg: "analytics_aggregator_skip", reason: "ANALYTICS_DAILY_TABLE unset" }));
    return;
  }
  const now = new Date();
  const dates = Array.from({ length: backfillDays }, (_, i) => utcDateString(now, -(backfillDays - 1 - i)));
  const agencies = await listAgencyRows();
  let written = 0;
  for (const date of dates) {
    for (const row of agencies) {
      const vertical = verticalFromAgencyType(row.type);
      try {
        const { metrics, hourly, hourlyBuckets } = await recountIncidentsForDay(row.agencyId, vertical, date);
        const { pk, sk } = analyticsDailyKeys(row.agencyId, vertical, date);
        await ddb.send(
          new PutCommand({
            TableName: table,
            Item: {
              pk,
              sk,
              agencyId: row.agencyId,
              vertical,
              date,
              metrics,
              hourly,
              hourlyBuckets,
              updatedAt: new Date().toISOString(),
              ttl: ttlTwoYears(),
            },
          }),
        );
        written += 1;
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "analytics_aggregator_agency_skip",
            userId: "system:analytics-aggregator",
            agencyId: row.agencyId,
            date,
            error: err instanceof Error ? err.message : "unknown",
          }),
        );
      }
    }
  }
  console.info(
    JSON.stringify({
      msg: "analytics_aggregator_nightly",
      userId: "system:analytics-aggregator",
      dates,
      agencies: agencies.length,
      written,
    }),
  );
}

export const handler = async (
  event: StreamLike | EventBridgeEvent<string, Record<string, unknown>> | { backfillDays?: number },
): Promise<{ ok: true }> => {
  if (event && "Records" in event && Array.isArray((event as StreamLike).Records)) {
    await handleStream(event as StreamLike);
    return { ok: true };
  }
  await handleNightly(parseBackfillDays(event));
  return { ok: true };
};
