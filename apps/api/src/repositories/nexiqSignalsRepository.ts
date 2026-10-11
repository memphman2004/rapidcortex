import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  NexiqSignalListQuery,
  NexiqSignalRecord,
  NexiqSignalStatus,
  NexiqSignalSummary,
  NexiqSignalTier,
  NexiqSignalVertical,
} from "rapid-cortex-shared";
import {
  emptyNexiqSignalSummary,
  NEXIQ_SIGNAL_MIN_CONFIDENCE,
  NEXIQ_SIGNAL_VERTICALS,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

const SK = "SOURCE#civiciq";
const STATUS_CREATED_INDEX = "status-createdAt-index";
const VERTICAL_STATUS_INDEX = "vertical-status-index";
const DEDUPE_INDEX = "dedupeHash-index";

function table(): string {
  const t = env.nexiqSignalsTable;
  if (!t) throw new Error("NEXIQ_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

export function nexiqSignalPk(signalId: string): string {
  return `SIGNAL#${signalId}`;
}

function passesListFilters(
  item: NexiqSignalRecord,
  q: NexiqSignalListQuery,
): boolean {
  if (item.confidenceScore < NEXIQ_SIGNAL_MIN_CONFIDENCE) return false;
  if (q.tier && item.confidenceTier !== q.tier) return false;
  if (!q.includeDismissed && item.status === "dismissed") return false;
  if (q.status && item.status !== q.status) {
    // When default status=new and includeDismissed, still respect status filter.
    if (!(q.includeDismissed && q.status === "dismissed")) return false;
  }
  return true;
}

function sortSignals(items: NexiqSignalRecord[]): NexiqSignalRecord[] {
  return [...items].sort((a, b) => {
    if (b.confidenceScore !== a.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export class NexiqSignalsRepository {
  async findByDedupeHash(dedupeHash: string): Promise<NexiqSignalRecord | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: DEDUPE_INDEX,
        KeyConditionExpression: "dedupeHash = :h",
        ExpressionAttributeValues: { ":h": dedupeHash },
        Limit: 1,
      }),
    );
    return (r.Items?.[0] as NexiqSignalRecord | undefined) ?? null;
  }

  async get(signalId: string): Promise<NexiqSignalRecord | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { pk: nexiqSignalPk(signalId), sk: SK },
      }),
    );
    return (r.Item as NexiqSignalRecord | undefined) ?? null;
  }

  async put(record: NexiqSignalRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: record,
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async list(
    q: NexiqSignalListQuery,
  ): Promise<{ items: NexiqSignalRecord[]; nextToken?: string }> {
    const limit = q.limit ?? 25;
    const exclusiveStartKey = q.nextToken
      ? (JSON.parse(Buffer.from(q.nextToken, "base64url").toString("utf8")) as Record<
          string,
          unknown
        >)
      : undefined;

    let items: NexiqSignalRecord[] = [];
    let lastKey: Record<string, unknown> | undefined = exclusiveStartKey;
    // Pull a page (or few) then filter/sort — GSI is status or vertical-scoped.
    for (let i = 0; i < 5 && items.length < limit; i++) {
      const page = await this.queryPage(q, lastKey, Math.max(limit * 2, 50));
      items = sortSignals([...items, ...page.items.filter((it) => passesListFilters(it, q))]);
      lastKey = page.lastKey;
      if (!lastKey) break;
    }

    const slice = items.slice(0, limit);
    const nextToken =
      lastKey && items.length > limit
        ? Buffer.from(JSON.stringify(lastKey), "utf8").toString("base64url")
        : lastKey
          ? Buffer.from(JSON.stringify(lastKey), "utf8").toString("base64url")
          : undefined;

    return { items: slice, nextToken };
  }

  private async queryPage(
    q: NexiqSignalListQuery,
    exclusiveStartKey: Record<string, unknown> | undefined,
    limit: number,
  ): Promise<{ items: NexiqSignalRecord[]; lastKey?: Record<string, unknown> }> {
    if (q.vertical) {
      const r = await ddb.send(
        new QueryCommand({
          TableName: table(),
          IndexName: VERTICAL_STATUS_INDEX,
          KeyConditionExpression: "vertical = :v AND #st = :s",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":v": q.vertical,
            ":s": q.status ?? "new",
          },
          ExclusiveStartKey: exclusiveStartKey,
          Limit: limit,
          ScanIndexForward: false,
        }),
      );
      return {
        items: (r.Items as NexiqSignalRecord[] | undefined) ?? [],
        lastKey: r.LastEvaluatedKey as Record<string, unknown> | undefined,
      };
    }

    const status = q.status ?? "new";
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: STATUS_CREATED_INDEX,
        KeyConditionExpression: "#st = :s",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":s": status },
        ExclusiveStartKey: exclusiveStartKey,
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    return {
      items: (r.Items as NexiqSignalRecord[] | undefined) ?? [],
      lastKey: r.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  async updateStatus(
    signalId: string,
    status: NexiqSignalStatus,
    reviewedBy: string,
    reviewedAt: string,
    apolloAccountId?: string | null,
  ): Promise<NexiqSignalRecord | null> {
    const names: Record<string, string> = {
      "#st": "status",
      "#rb": "reviewedBy",
      "#ra": "reviewedAt",
    };
    const values: Record<string, unknown> = {
      ":st": status,
      ":rb": reviewedBy,
      ":ra": reviewedAt,
    };
    let update = "SET #st = :st, #rb = :rb, #ra = :ra";
    if (apolloAccountId !== undefined) {
      names["#aa"] = "apolloAccountId";
      values[":aa"] = apolloAccountId;
      update += ", #aa = :aa";
    }
    const r = await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { pk: nexiqSignalPk(signalId), sk: SK },
        UpdateExpression: update,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(pk)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return (r.Attributes as NexiqSignalRecord | undefined) ?? null;
  }

  async summary(): Promise<NexiqSignalSummary> {
    const out = emptyNexiqSignalSummary();
    const statuses: NexiqSignalStatus[] = ["new", "tracking", "pushed_to_crm"];
    for (const status of statuses) {
      let startKey: Record<string, unknown> | undefined;
      do {
        const r = await ddb.send(
          new QueryCommand({
            TableName: table(),
            IndexName: STATUS_CREATED_INDEX,
            KeyConditionExpression: "#st = :s",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: { ":s": status },
            ExclusiveStartKey: startKey,
            ProjectionExpression: "vertical, confidenceScore, confidenceTier, #st",
          }),
        );
        for (const raw of r.Items ?? []) {
          const item = raw as {
            vertical?: NexiqSignalVertical;
            confidenceScore?: number;
            confidenceTier?: NexiqSignalTier;
            status?: NexiqSignalStatus;
          };
          if ((item.confidenceScore ?? 0) < NEXIQ_SIGNAL_MIN_CONFIDENCE) continue;
          if (status === "new") out.new += 1;
          if (status === "tracking") out.tracking += 1;
          if (status === "pushed_to_crm") out.pushed_to_crm += 1;
          if (item.confidenceTier === "high" && (status === "new" || status === "tracking")) {
            out.high_tier += 1;
          }
          const v = item.vertical;
          if (v && (NEXIQ_SIGNAL_VERTICALS as readonly string[]).includes(v)) {
            if (status === "new") out.by_vertical[v].new += 1;
            if (status === "tracking") out.by_vertical[v].tracking += 1;
          }
        }
        startKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (startKey);
    }
    return out;
  }
}

export const NEXIQ_SIGNAL_SK = SK;
