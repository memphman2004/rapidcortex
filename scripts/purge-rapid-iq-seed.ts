#!/usr/bin/env npx tsx
/**
 * Deletes Rapid IQ seed / demo rows from DynamoDB (opportunityId / sourceId / signalId
 * prefixes `seed-` / `demo-`, plus sources/contacts GSI-linked to those opportunities).
 *
 * Does NOT touch the jurisdictions registry.
 *
 * Run:
 *   STAGE=dev AWS_PROFILE=rapid-cortex npx tsx scripts/purge-rapid-iq-seed.ts
 *   DRY_RUN=1 STAGE=dev npx tsx scripts/purge-rapid-iq-seed.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const STAGE = process.env.STAGE ?? "dev";
const PREFIX = process.env.DYNAMO_TABLE_PREFIX ?? "rapid-cortex";
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const OPP =
  process.env.RAPID_IQ_OPPORTUNITIES_TABLE ?? `${PREFIX}-rapid-iq-opportunities-${STAGE}`;
const SIG = process.env.RAPID_IQ_SIGNALS_TABLE ?? `${PREFIX}-rapid-iq-signals-${STAGE}`;
const CON = process.env.RAPID_IQ_CONTACTS_TABLE ?? `${PREFIX}-rapid-iq-contacts-${STAGE}`;
const SRC = process.env.RAPID_IQ_SOURCES_TABLE ?? `${PREFIX}-rapid-iq-sources-${STAGE}`;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function isSeedId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return id.startsWith("seed-") || id.startsWith("demo-") || id.startsWith("src#sig#seed-");
}

/** Source/platform labels mis-stored as agencyName (live collector bug). */
const BAD_AGENCY_NAMES = [
  "grants.gov",
  "sam.gov",
  "ntia",
  "fema",
  "pennsylvania 911 program",
  "california e911",
  "texas csec",
  "fema bric",
  "usac",
];

function isBadAgencyOpportunity(item: Record<string, unknown>): boolean {
  if (isSeedId(item.opportunityId)) return true;
  const agency = String(item.agencyName ?? "").toLowerCase();
  if (!agency) return false;
  return BAD_AGENCY_NAMES.some((n) => agency === n || agency.includes(n));
}

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

async function queryByOpportunity(
  tableName: string,
  opportunityId: string,
  indexName: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: "opportunityId = :id",
        ExpressionAttributeValues: { ":id": opportunityId },
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

async function batchDelete(
  tableName: string,
  keys: Array<Record<string, unknown>>,
): Promise<number> {
  if (keys.length === 0) return 0;
  if (DRY_RUN) {
    console.log(`[dry-run] would delete ${keys.length} from ${tableName}`);
    return keys.length;
  }
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
        },
      }),
    );
    deleted += chunk.length;
  }
  return deleted;
}

async function main(): Promise<void> {
  console.log(`Purging Rapid IQ seed/demo data (stage=${STAGE}, dryRun=${DRY_RUN})`);
  console.log(`Tables: ${OPP}, ${SIG}, ${CON}, ${SRC}`);

  const opps = await scanAll(OPP);
  const seedOppIds = opps
    .filter((o) => isBadAgencyOpportunity(o))
    .map((o) => String(o.opportunityId ?? ""))
    .filter(Boolean);

  console.log(
    `Found ${seedOppIds.length} seed/demo/bad-agency opportunities: ${seedOppIds.join(", ") || "(none)"}`,
  );

  let sigKeys: Array<Record<string, unknown>> = [];
  let conKeys: Array<Record<string, unknown>> = [];
  let srcKeys: Array<Record<string, unknown>> = [];

  for (const opportunityId of seedOppIds) {
    const [signals, contacts, sources] = await Promise.all([
      queryByOpportunity(SIG, opportunityId, "opportunityId-published-index"),
      queryByOpportunity(CON, opportunityId, "opportunityId-index"),
      queryByOpportunity(SRC, opportunityId, "opportunityId-index"),
    ]);
    sigKeys.push(...signals.map((s) => ({ signalId: s.signalId })));
    conKeys.push(...contacts.map((c) => ({ contactId: c.contactId })));
    srcKeys.push(...sources.map((s) => ({ sourceId: s.sourceId })));
  }

  // Also catch orphaned seed-prefixed rows
  const [allSig, allSrc] = await Promise.all([scanAll(SIG), scanAll(SRC)]);
  for (const s of allSig) {
    if (isSeedId(s.signalId) || isSeedId(s.opportunityId)) {
      sigKeys.push({ signalId: s.signalId });
    }
  }
  for (const s of allSrc) {
    if (isSeedId(s.sourceId) || isSeedId(s.opportunityId)) {
      srcKeys.push({ sourceId: s.sourceId });
    }
  }

  const uniq = <T extends Record<string, unknown>>(rows: T[], key: string): T[] => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const id = String(r[key] ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  sigKeys = uniq(sigKeys, "signalId");
  conKeys = uniq(conKeys, "contactId");
  srcKeys = uniq(srcKeys, "sourceId");
  const oppKeys = seedOppIds.map((opportunityId) => ({ opportunityId }));

  const nSig = await batchDelete(SIG, sigKeys);
  const nCon = await batchDelete(CON, conKeys);
  const nSrc = await batchDelete(SRC, srcKeys);
  const nOpp = await batchDelete(OPP, oppKeys);

  console.log(
    JSON.stringify({
      msg: "rapid_iq_seed_purge_complete",
      opportunities: nOpp,
      signals: nSig,
      contacts: nCon,
      sources: nSrc,
      dryRun: DRY_RUN,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
