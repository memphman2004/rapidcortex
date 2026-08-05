/**
 * Enrich PSAP mailing addresses via Nominatim (OpenStreetMap).
 *
 * Usage:
 *   PSAP_PROSPECTS_TABLE=rapid-cortex-psap-prospects-dev \
 *     npx tsx scripts/enrich-psap-addresses.ts [--state TX] [--limit 100]
 *
 * Rate limit: ~1.1s between requests. Checkpoint: `.psap-enrich.checkpoint`
 * User-Agent required by Nominatim ToS.
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.PSAP_PROSPECTS_TABLE;
if (!TABLE) {
  console.error("ERROR: PSAP_PROSPECTS_TABLE env var is required");
  process.exit(1);
}

const CHECKPOINT = resolve(process.cwd(), ".psap-enrich.checkpoint");
const DELAY_MS = 1100;
const USER_AGENT = "RapidCortex-AddressEnrichment/1.0 (support@rapidcortex.us)";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function parseArgs(argv: string[]) {
  let state: string | undefined;
  let limit = Number.POSITIVE_INFINITY;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--state" && argv[i + 1]) {
      state = argv[++i]!.toUpperCase();
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Number(argv[++i]);
    }
  }
  return { state, limit: Number.isFinite(limit) && limit > 0 ? limit : Number.POSITIVE_INFINITY };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCheckpoint(): Set<string> {
  if (!existsSync(CHECKPOINT)) return new Set();
  try {
    const lines = readFileSync(CHECKPOINT, "utf8").split(/\r?\n/).filter(Boolean);
    return new Set(lines);
  } catch {
    return new Set();
  }
}

function appendCheckpoint(psapId: string) {
  writeFileSync(CHECKPOINT, `${psapId}\n`, { flag: "a" });
}

type ProspectRow = {
  psapId: string;
  psapName: string;
  city: string;
  county: string;
  state: string;
  mailingAddress?: { streetAddress?: string; verified?: boolean };
};

async function listCandidates(state?: string): Promise<ProspectRow[]> {
  const items: ProspectRow[] = [];
  if (state) {
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await client.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: "StateUpdatedIndex",
          KeyConditionExpression: "#st = :st",
          ExpressionAttributeNames: { "#st": "state" },
          ExpressionAttributeValues: { ":st": state },
          ExclusiveStartKey,
        }),
      );
      for (const it of r.Items ?? []) items.push(it as ProspectRow);
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
  } else {
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await client.send(
        new ScanCommand({
          TableName: TABLE,
          ExclusiveStartKey,
        }),
      );
      for (const it of r.Items ?? []) items.push(it as ProspectRow);
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
  }
  return items.filter((p) => !p.mailingAddress?.streetAddress?.trim());
}

type NominatimResult = {
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

async function nominatimSearch(q: string): Promise<NominatimResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn(`Nominatim HTTP ${res.status} for ${q}`);
    return null;
  }
  const data = (await res.json()) as NominatimResult[];
  return data[0] ?? null;
}

async function enrichOne(p: ProspectRow): Promise<boolean> {
  const query = `${p.psapName}, ${p.city}, ${p.state}, USA`;
  const hit = await nominatimSearch(query);
  if (!hit?.address) return false;

  const house = hit.address.house_number?.trim() ?? "";
  const road = hit.address.road?.trim() ?? "";
  const streetAddress = [house, road].filter(Boolean).join(" ").trim();
  if (!streetAddress) return false;

  const now = new Date().toISOString();
  const mailingAddress = {
    streetAddress,
    city: (hit.address.city || hit.address.town || hit.address.village || p.city).trim(),
    county: (hit.address.county || p.county).trim(),
    state: p.state,
    zip: hit.address.postcode?.trim(),
    verified: false,
    enrichedAt: now,
    source: "nominatim" as const,
  };

  await client.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { psapId: p.psapId },
      UpdateExpression: "SET mailingAddress = :m, updatedAt = :u",
      ExpressionAttributeValues: {
        ":m": mailingAddress,
        ":u": now,
      },
    }),
  );
  return true;
}

async function main() {
  const { state, limit } = parseArgs(process.argv.slice(2));
  const done = loadCheckpoint();
  const candidates = await listCandidates(state);
  const pending = candidates.filter((p) => !done.has(p.psapId)).slice(0, limit);

  console.log(
    `Enriching ${pending.length} of ${candidates.length} candidates` +
      (state ? ` (state=${state})` : "") +
      ` → ${TABLE}`,
  );

  let enriched = 0;
  let missed = 0;
  let errors = 0;

  for (const p of pending) {
    try {
      const ok = await enrichOne(p);
      if (ok) {
        enriched++;
        console.log(`✓ ${p.psapId} ${p.psapName}`);
      } else {
        missed++;
        console.log(`· no hit ${p.psapId} ${p.psapName}`);
      }
      appendCheckpoint(p.psapId);
    } catch (e) {
      errors++;
      console.error(`✗ ${p.psapId}`, e);
      appendCheckpoint(p.psapId);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. enriched=${enriched} missed=${missed} errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
