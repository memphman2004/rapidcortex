/**
 * County / city procurement portal registry.
 * Complements agenda seeds in jurisdiction-registry.ts — do not duplicate those
 * hosts into ALL_JURISDICTIONS. Portal platforms (OpenGov, PlanetBids, …) are
 * crawled by ingest-county-procurement; custom same-host paths enrich agenda crawls.
 */

import registryJson from "./county-procurement-registry.json";
import type { Jurisdiction } from "./jurisdiction-registry.js";

export const COUNTY_PROCUREMENT_PLATFORMS = [
  "opengov",
  "custom",
  "planetbids",
  "demandstar",
  "bidnet",
  "ionwave",
  "periscope",
  "publicpurchase",
  "state-portal",
] as const;

export type CountyProcurementPlatform = (typeof COUNTY_PROCUREMENT_PLATFORMS)[number];

export type CountyProcurementEntry = {
  state: string;
  county: string;
  pop: number;
  platform: CountyProcurementPlatform;
  url: string;
  slug?: string;
  companyId?: string;
};

type RawCountyRow = {
  state: string;
  county: string;
  pop: number;
  platform: string;
  url: string;
  slug?: string;
  company_id?: string;
};

const PLATFORM_SET = new Set<string>(COUNTY_PROCUREMENT_PLATFORMS);

const PLATFORM_RANK: Record<string, number> = {
  opengov: 5,
  planetbids: 5,
  demandstar: 4,
  bidnet: 4,
  ionwave: 3,
  periscope: 3,
  publicpurchase: 3,
  custom: 2,
  "state-portal": 0,
};

/** Consolidated / alias keys after strip (state#token). */
const COUNTY_KEY_ALIASES: Record<string, string> = {
  "ga#bibb": "ga#maconbibb",
  "ga#macon": "ga#maconbibb",
  "ny#kings": "ny#nyc",
  "ny#queens": "ny#nyc",
  "ny#newyork": "ny#nyc",
  "ny#bronx": "ny#nyc",
  "ny#richmond": "ny#nyc",
  "ny#statenisland": "ny#nyc",
  "ny#manhattan": "ny#nyc",
  "ny#brooklyn": "ny#nyc",
  "ak#cityandboroughofjuneau": "ak#juneau",
};

function isPlatform(value: string): value is CountyProcurementPlatform {
  return PLATFORM_SET.has(value);
}

function toEntry(row: RawCountyRow): CountyProcurementEntry | null {
  if (!isPlatform(row.platform) || !row.state || !row.county || !row.url) return null;
  return {
    state: row.state.toUpperCase(),
    county: row.county.trim(),
    pop: Number(row.pop) || 0,
    platform: row.platform,
    url: row.url.trim(),
    slug: row.slug?.trim() || undefined,
    companyId: row.company_id?.trim() || undefined,
  };
}

export function normalizeCountyKey(stateCode: string, name: string): string {
  const state = stateCode.trim().toUpperCase();
  let token = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(
      /\b(city and borough of|city and county of|city and borough|city and county|consolidated city-county|municipality of)\b/g,
      " ",
    )
    .replace(/\b(county|parish|borough|census area|municipality|city|town)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
  const aliased = COUNTY_KEY_ALIASES[`${state.toLowerCase()}#${token}`];
  if (aliased) {
    const [, rest] = aliased.split("#");
    token = rest ?? token;
  }
  return `${state.toLowerCase()}#${token}`;
}

export function normalizeProcurementUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let host = u.host.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${host}${path}`;
  } catch {
    return url.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

let cachedEntries: CountyProcurementEntry[] | null = null;

export function allCountyProcurementEntries(): CountyProcurementEntry[] {
  if (cachedEntries) return cachedEntries;
  const raw = (registryJson as { counties?: RawCountyRow[] }).counties ?? [];
  const byKey = new Map<string, CountyProcurementEntry>();
  for (const row of raw) {
    const entry = toEntry(row);
    if (!entry) continue;
    const key = normalizeCountyKey(entry.state, entry.county);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, entry);
      continue;
    }
    const rank = PLATFORM_RANK[entry.platform] ?? 0;
    const prevRank = PLATFORM_RANK[prev.platform] ?? 0;
    if (rank > prevRank || (rank === prevRank && entry.pop > prev.pop)) {
      byKey.set(key, entry);
    }
  }
  cachedEntries = [...byKey.values()];
  return cachedEntries;
}

/**
 * Entries the portal crawler should fetch: skip state portals (covered elsewhere)
 * and collapse identical URLs (e.g. NYC boroughs sharing nyc.gov/purchasing).
 */
export function crawlableCountyProcurementEntries(): CountyProcurementEntry[] {
  const byUrl = new Map<string, CountyProcurementEntry>();
  for (const entry of allCountyProcurementEntries()) {
    if (entry.platform === "state-portal") continue;
    const urlKey = normalizeProcurementUrl(entry.url);
    const prev = byUrl.get(urlKey);
    if (!prev || entry.pop > prev.pop) byUrl.set(urlKey, entry);
  }
  return [...byUrl.values()];
}

export function matchCountyProcurement(
  stateCode: string,
  name: string,
): CountyProcurementEntry | undefined {
  const key = normalizeCountyKey(stateCode, name);
  return allCountyProcurementEntries().find((e) => normalizeCountyKey(e.state, e.county) === key);
}

/** Same-host custom purchasing path for agenda crawls (OpenGov/PlanetBids stay on the pipeline). */
export function customProcurementPathHint(
  j: Pick<Jurisdiction, "stateCode" | "name" | "agendaBaseUrl">,
): string | undefined {
  const hit = matchCountyProcurement(j.stateCode, j.name);
  if (!hit || hit.platform !== "custom") return undefined;
  try {
    const portal = new URL(hit.url);
    const base = new URL(j.agendaBaseUrl);
    if (hostOf(portal.href) !== hostOf(base.href)) return undefined;
    const path = portal.pathname.replace(/\/+$/, "");
    return path && path !== "/" ? path : undefined;
  } catch {
    return undefined;
  }
}

/** Absolute custom portal pages to fetch in addition to relative agenda hints. */
export function customProcurementPageUrls(
  j: Pick<Jurisdiction, "stateCode" | "name" | "agendaBaseUrl">,
): string[] {
  const hit = matchCountyProcurement(j.stateCode, j.name);
  if (!hit || hit.platform !== "custom") return [];
  if (hostOf(hit.url) !== hostOf(j.agendaBaseUrl)) return [];
  return [hit.url];
}
