/**
 * Opportunity Intelligence persistence on RAPID_IQ_PIPELINE_SIGNALS_TABLE
 * (same single-table as pipeline signals; distinct pk prefixes).
 */

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  RAPID_IQ_TRANSIT_WATCH_SEEDS,
  defaultTransitWatchKeywords,
  normalizeIntelUrl,
  rapidIqIntelOpportunitySchema,
  rapidIqIntelWatchSchema,
  type RapidIqIntelOpportunity,
  type RapidIqIntelWatch,
} from "rapid-cortex-shared";
import { env } from "../env.js";
import { ddb } from "../../repositories/baseRepository.js";
import { titleIndexKey } from "./intel-merge.js";

function table(): string {
  const t = env.rapidIqPipelineSignalsTable?.trim() || process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function intelPk(id: string) {
  return `INTEL#${id}`;
}

function watchPk(id: string) {
  return `WATCH#${id}`;
}

function hashPk(fingerprint: string) {
  return `INTELHASH#${fingerprint}`;
}

function stripKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const {
    pk: _pk,
    sk: _sk,
    gsi1pk: _g1,
    gsi1sk: _g1s,
    gsi2pk: _g2,
    gsi2sk: _g2s,
    entityType: _et,
    ...rest
  } = obj;
  void _pk;
  void _sk;
  void _g1;
  void _g1s;
  void _g2;
  void _g2s;
  void _et;
  return rest;
}

export async function putIntelOpportunity(row: RapidIqIntelOpportunity): Promise<void> {
  const parsed = rapidIqIntelOpportunitySchema.parse(row);
  const fit = String(parsed.fitScore).padStart(4, "0");
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...parsed,
        pk: intelPk(parsed.id),
        sk: "META",
        entityType: "intel",
        gsi1pk: `INTEL_STATUS#${parsed.status}`,
        gsi1sk: `${fit}#${parsed.discoveredAt}`,
        gsi2pk: `INTEL_MARKET#${parsed.market}`,
        gsi2sk: parsed.discoveredAt,
      },
    }),
  );
}

export async function getIntelOpportunity(id: string): Promise<RapidIqIntelOpportunity | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: table(), Key: { pk: intelPk(id), sk: "META" } }),
  );
  if (!res.Item) return null;
  const parsed = rapidIqIntelOpportunitySchema.safeParse(stripKeys(res.Item as Record<string, unknown>));
  return parsed.success ? parsed.data : null;
}

export async function getIntelIdByFingerprint(fingerprint: string): Promise<string | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: table(), Key: { pk: hashPk(fingerprint), sk: "META" } }),
  );
  const id = res.Item?.intelId;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function getIntelIdBySolicitation(
  agency: string,
  solicitationNumber: string,
): Promise<string | null> {
  const key = `INTELSOL#${agency.trim().toLowerCase()}#${solicitationNumber.trim().toLowerCase()}`;
  const res = await ddb.send(
    new GetCommand({ TableName: table(), Key: { pk: key, sk: "META" } }),
  );
  const id = res.Item?.intelId;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function getIntelIdByUrl(url: string): Promise<string | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: `INTELURL#${normalizeIntelUrl(url)}`, sk: "META" },
    }),
  );
  const id = res.Item?.intelId;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function getIntelIdByTitle(agency: string, title: string): Promise<string | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: titleIndexKey(agency, title), sk: "META" },
    }),
  );
  const id = res.Item?.intelId;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function reserveIntelIndexes(input: {
  intelId: string;
  fingerprint: string;
  sourceUrl: string;
  agency: string;
  title: string;
  solicitationNumber?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: { pk: hashPk(input.fingerprint), sk: "META", intelId: input.intelId, createdAt: now },
    }),
  );
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: `INTELURL#${normalizeIntelUrl(input.sourceUrl)}`,
        sk: "META",
        intelId: input.intelId,
        createdAt: now,
      },
    }),
  );
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: { pk: titleIndexKey(input.agency, input.title), sk: "META", intelId: input.intelId, createdAt: now },
    }),
  );
  if (input.solicitationNumber?.trim()) {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          pk: `INTELSOL#${input.agency.trim().toLowerCase()}#${input.solicitationNumber.trim().toLowerCase()}`,
          sk: "META",
          intelId: input.intelId,
          createdAt: now,
        },
      }),
    );
  }
}

const INTEL_STATUSES = ["NEW", "WATCHING", "QUALIFIED", "PURSUING", "PASSED", "WON", "LOST"] as const;

export async function listIntelOpportunities(limit = 200): Promise<RapidIqIntelOpportunity[]> {
  const per = Math.max(1, Math.ceil(limit / INTEL_STATUSES.length));
  const chunks = await Promise.all(
    INTEL_STATUSES.map(async (status) => {
      const res = await ddb.send(
        new QueryCommand({
          TableName: table(),
          IndexName: "gsi1-status-score",
          KeyConditionExpression: "gsi1pk = :pk",
          ExpressionAttributeValues: { ":pk": `INTEL_STATUS#${status}` },
          ScanIndexForward: false,
          Limit: per,
        }),
      );
      return (res.Items ?? [])
        .map((item) => rapidIqIntelOpportunitySchema.safeParse(stripKeys(item as Record<string, unknown>)))
        .filter((p) => p.success)
        .map((p) => p.data);
    }),
  );
  return chunks.flat();
}

export async function putIntelWatch(watch: RapidIqIntelWatch): Promise<void> {
  const parsed = rapidIqIntelWatchSchema.parse(watch);
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...parsed,
        pk: watchPk(parsed.id),
        sk: "META",
        entityType: "watch",
        gsi1pk: `WATCH_MARKET#${parsed.market}`,
        gsi1sk: parsed.updatedAt,
        gsi2pk: "WATCH#ALL",
        gsi2sk: parsed.updatedAt,
      },
    }),
  );
}

export async function getIntelWatch(id: string): Promise<RapidIqIntelWatch | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: table(), Key: { pk: watchPk(id), sk: "META" } }),
  );
  if (!res.Item) return null;
  const parsed = rapidIqIntelWatchSchema.safeParse(stripKeys(res.Item as Record<string, unknown>));
  return parsed.success ? parsed.data : null;
}

export async function listIntelWatches(): Promise<RapidIqIntelWatch[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table(),
      IndexName: "gsi2-source-date",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": "WATCH#ALL" },
      ScanIndexForward: false,
      Limit: 200,
    }),
  );
  return (res.Items ?? [])
    .map((item) => rapidIqIntelWatchSchema.safeParse(stripKeys(item as Record<string, unknown>)))
    .filter((p) => p.success)
    .map((p) => p.data);
}

export async function seedDefaultTransitWatches(): Promise<number> {
  const existing = await listIntelWatches();
  if (existing.length > 0) return 0;
  const now = new Date().toISOString();
  const keywords = defaultTransitWatchKeywords();
  let created = 0;
  for (const seed of RAPID_IQ_TRANSIT_WATCH_SEEDS) {
    await putIntelWatch({
      id: seed.id,
      name: seed.name,
      agency: seed.agency,
      market: "TRANSIT",
      enabled: true,
      keywords,
      sourceDomains: [...seed.sourceDomains],
      sourceUrls: [...seed.sourceUrls],
      minimumFitScore: 7,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }
  return created;
}

export async function updateIntelOpportunityFields(
  id: string,
  fields: Partial<RapidIqIntelOpportunity>,
): Promise<RapidIqIntelOpportunity> {
  const current = await getIntelOpportunity(id);
  if (!current) throw new Error(`Intel opportunity ${id} not found`);
  const next: RapidIqIntelOpportunity = {
    ...current,
    ...fields,
    lastUpdatedAt: new Date().toISOString(),
  };
  await putIntelOpportunity(next);
  return next;
}

export async function updateIntelWatchFields(
  id: string,
  fields: Partial<RapidIqIntelWatch>,
): Promise<RapidIqIntelWatch> {
  const current = await getIntelWatch(id);
  if (!current) throw new Error(`Watch ${id} not found`);
  const next: RapidIqIntelWatch = {
    ...current,
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  await putIntelWatch(next);
  return next;
}
