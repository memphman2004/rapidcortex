import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export type IQVertical = "911" | "campus" | "venue" | "transit" | "hospital";

export type IQDailyRecord = {
  agencyId: string;
  vertical: IQVertical;
  date: string;
  metrics: Record<string, number>;
  hourlyBuckets: number[];
  updatedAt: string;
};

const VERTICALS = new Set<IQVertical>(["911", "campus", "venue", "transit", "hospital"]);

let doc: DynamoDBDocumentClient | null = null;

export function analyticsDocClient(): DynamoDBDocumentClient {
  if (!doc) {
    const client = new DynamoDBClient(
      process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {},
    );
    doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }
  return doc;
}

export function isIQVertical(value: string): value is IQVertical {
  return VERTICALS.has(value as IQVertical);
}

export function mapDailyItem(
  item: Record<string, unknown>,
  fallback: { agencyId: string; vertical: IQVertical },
): IQDailyRecord {
  const metricsRaw = item.metrics;
  const metrics: Record<string, number> = {};
  if (metricsRaw && typeof metricsRaw === "object") {
    for (const [k, v] of Object.entries(metricsRaw as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) metrics[k] = n;
    }
  }
  const hourlyRaw = item.hourlyBuckets ?? item.hourly_buckets ?? item.hourly;
  const hourlyBuckets = Array.from({ length: 24 }, () => 0);
  if (Array.isArray(hourlyRaw)) {
    for (let i = 0; i < 24; i++) {
      const n = Number(hourlyRaw[i] ?? 0);
      hourlyBuckets[i] = Number.isFinite(n) ? n : 0;
    }
  } else if (hourlyRaw && typeof hourlyRaw === "object") {
    for (let i = 0; i < 24; i++) {
      const n = Number((hourlyRaw as Record<string, unknown>)[String(i)] ?? 0);
      hourlyBuckets[i] = Number.isFinite(n) ? n : 0;
    }
  }
  const date =
    typeof item.date === "string"
      ? item.date
      : String(item.sk ?? "").replace(/^DATE#/, "").slice(0, 10);
  return {
    agencyId: typeof item.agencyId === "string" ? item.agencyId : fallback.agencyId,
    vertical: (typeof item.vertical === "string" ? item.vertical : fallback.vertical) as IQVertical,
    date,
    metrics,
    hourlyBuckets,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
  };
}

export async function queryIQDailyRecords(input: {
  agencyId: string;
  vertical: IQVertical;
  startDate: string;
  endDate: string;
}): Promise<IQDailyRecord[]> {
  const tableName = process.env.ANALYTICS_DAILY_TABLE?.trim();
  if (!tableName) return [];
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await analyticsDocClient().send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":pk": `AGENCY#${input.agencyId}#VERTICAL#${input.vertical}`,
          ":from": `DATE#${input.startDate}`,
          ":to": `DATE#${input.endDate}`,
        },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    for (const item of result.Items ?? []) {
      items.push(item as Record<string, unknown>);
    }
    exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  return items.map((item) =>
    mapDailyItem(item, {
      agencyId: input.agencyId,
      vertical: input.vertical,
    }),
  );
}
