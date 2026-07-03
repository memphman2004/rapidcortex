/**
 * FIPS → agencyId router for CAP alerts.
 */

import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../env.js";
import { ddb } from "../../../repositories/baseRepository.js";
import type { AgencyFipsConfig } from "./cap-types.js";

const FIPS_GSI = env.capFipsGsiName || "CapFipsIndex";
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  configs: AgencyFipsConfig[];
  fetchedAt: number;
}

const fipsCache = new Map<string, CacheEntry>();

function table(): string {
  return env.cadIntegrationsTable?.trim() ?? "";
}

function getCached(fipsCode: string): AgencyFipsConfig[] | null {
  const entry = fipsCache.get(fipsCode);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    fipsCache.delete(fipsCode);
    return null;
  }
  return entry.configs;
}

function setCache(fipsCode: string, configs: AgencyFipsConfig[]): void {
  fipsCache.set(fipsCode, { configs, fetchedAt: Date.now() });
}

export function clearFipsCache(): void {
  fipsCache.clear();
}

function configFromItem(item: Record<string, unknown>): AgencyFipsConfig | null {
  if (item.connectionType !== "cap_inbound") return null;
  const cfg = (item.config ?? {}) as Record<string, unknown>;
  const acceptCapAlerts = Boolean(item.acceptCapAlerts ?? cfg.acceptCapAlerts ?? false);
  if (!acceptCapAlerts) return null;

  const fipsRaw = item.fipsCodes ?? cfg.fipsCodes;
  const fipsCodes = Array.isArray(fipsRaw) ? fipsRaw.map(String) : [];

  return {
    agencyId: String(item.agencyId ?? ""),
    integrationId: typeof item.id === "string" ? item.id : undefined,
    fipsCodes,
    acceptCapAlerts: true,
    capAuthToken:
      typeof item.capAuthToken === "string"
        ? item.capAuthToken
        : typeof cfg.capAuthToken === "string"
          ? cfg.capAuthToken
          : undefined,
    acceptExercise: Boolean(item.acceptExercise ?? cfg.acceptExercise),
    acceptTest: Boolean(item.acceptTest ?? cfg.acceptTest),
  };
}

async function lookupByGsi(fipsCode: string): Promise<AgencyFipsConfig[]> {
  const t = table();
  if (!t) return [];
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: t,
        IndexName: FIPS_GSI,
        KeyConditionExpression: "fipsCode = :fips",
        FilterExpression: "connectionType = :ct",
        ExpressionAttributeValues: {
          ":fips": fipsCode,
          ":ct": "cap_inbound",
        },
      }),
    );
    return (result.Items ?? [])
      .map((item) => configFromItem(item as Record<string, unknown>))
      .filter((c): c is AgencyFipsConfig => c !== null);
  } catch (e) {
    console.warn("[cap-fips-router] GSI lookup failed, falling back to scan:", (e as Error).message);
    return [];
  }
}

let allCapConfigs: AgencyFipsConfig[] | null = null;
let allConfigsFetchedAt = 0;

async function getAllCapConfigs(): Promise<AgencyFipsConfig[]> {
  if (allCapConfigs && Date.now() - allConfigsFetchedAt < 5 * 60_000) {
    return allCapConfigs;
  }

  const t = table();
  if (!t) return [];

  const configs: AgencyFipsConfig[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: t,
        FilterExpression: "connectionType = :ct",
        ExpressionAttributeValues: { ":ct": "cap_inbound" },
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of result.Items ?? []) {
      const cfg = configFromItem(item as Record<string, unknown>);
      if (cfg) configs.push(cfg);
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  allCapConfigs = configs;
  allConfigsFetchedAt = Date.now();
  return configs;
}

export interface FipsRoutingResult {
  matches: AgencyFipsConfig[];
  unmatchedFips: string[];
  usedGsi: boolean;
}

export async function routeFipsCodes(fipsCodes: string[]): Promise<FipsRoutingResult> {
  if (!table() || fipsCodes.length === 0) {
    return { matches: [], unmatchedFips: fipsCodes, usedGsi: false };
  }

  const agencyMap = new Map<string, AgencyFipsConfig>();
  const unmatchedFips: string[] = [];
  let usedGsi = false;

  let anyGsiResult = false;
  for (const fips of fipsCodes) {
    const cached = getCached(fips);
    if (cached !== null) {
      for (const cfg of cached) agencyMap.set(cfg.agencyId, cfg);
      if (cached.length === 0) unmatchedFips.push(fips);
      continue;
    }

    const gsiResults = await lookupByGsi(fips);
    if (gsiResults.length > 0) {
      anyGsiResult = true;
      usedGsi = true;
      setCache(fips, gsiResults);
      for (const cfg of gsiResults) agencyMap.set(cfg.agencyId, cfg);
    } else {
      break;
    }
  }

  if (!anyGsiResult && agencyMap.size === 0) {
    const allConfigs = await getAllCapConfigs();
    for (const fips of fipsCodes) {
      const matching = allConfigs.filter((cfg) =>
        cfg.fipsCodes.some((f) => normalizeFips(f) === normalizeFips(fips)),
      );
      setCache(fips, matching);
      if (matching.length === 0) {
        unmatchedFips.push(fips);
      } else {
        for (const cfg of matching) agencyMap.set(cfg.agencyId, cfg);
      }
    }
  }

  return {
    matches: [...agencyMap.values()],
    unmatchedFips,
    usedGsi,
  };
}

function normalizeFips(raw: string): string {
  return raw.replace(/\D/g, "").padStart(6, "0").slice(0, 6);
}

export function validateCapToken(
  config: AgencyFipsConfig,
  providedToken: string | null | undefined,
): boolean {
  if (!config.capAuthToken) return true;
  if (!providedToken) return false;

  const expected = Buffer.from(config.capAuthToken, "utf8");
  const provided = Buffer.from(providedToken, "utf8");
  if (expected.length !== provided.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected[i] ^ provided[i];
  }
  return mismatch === 0;
}

/** Load CAP config for a specific agency (direct routing). */
export async function loadAgencyCapConfig(agencyId: string): Promise<AgencyFipsConfig | null> {
  const all = await getAllCapConfigs();
  return all.find((c) => c.agencyId === agencyId) ?? null;
}

/** Resolve integration id for SNS ingress (prefers active cap_inbound). */
export async function resolveCapIntegrationId(agencyId: string): Promise<string | null> {
  const cfg = await loadAgencyCapConfig(agencyId);
  return cfg?.integrationId ?? null;
}

/** Persist idempotency marker — exported for tests. */
export async function markCapDedup(
  tableName: string,
  dedupeKey: string,
  ttlSec: number,
): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: { dedupeKey, responseJson: "{}", ttl: ttlSec },
        ConditionExpression: "attribute_not_exists(dedupeKey)",
      }),
    );
    return false;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "ConditionalCheckFailedException") return true;
    console.warn("[cap-ingest] dedup check error:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
