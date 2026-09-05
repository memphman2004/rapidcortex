/**
 * OpenAI web-search URL discovery for Opportunity Intelligence watches.
 * sourceId openai-web-search: discovered URLs are fetched the same day only
 * (not written back onto WATCH# sourceUrls).
 *
 * Discovery runs in the watch worker (not the orchestrator) so:
 *   - daily cron and "Run" share one path
 *   - the orchestrator only seeds + enqueues (no 88 web-search calls in 60–120s)
 *   - mock collectors skip live OpenAI
 * Discovered URLs merge into that run's fetch list only — they are not written
 * back onto WATCH# sourceUrls.
 *
 * Global gate: OPENAI_WEB_SEARCH_ENABLED=true (pipeline stack parameter).
 * Per-watch gate: watch.webSearchEnabled === true.
 */

import type { RapidIqIntelWatch } from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { createJsonResponse } from "./openai-client.js";
import {
  isRapidIqWebSearchEnabled,
  rapidIqModelClassification,
} from "./openai-config.js";

const URL_PATTERN = /https?:\/\/[^\s"'<>()]+/g;

const PROCUREMENT_HOST_SUFFIXES = [
  "planetbids.com",
  "bonfirehub.com",
  "bidnet.com",
  "opengov.com",
  "bidsync.com",
  "demandstar.com",
  "negometrix.com",
  "sciquest.com",
  "jaggaer.com",
  "ionwave.net",
  "sam.gov",
  "grants.gov",
  "usaspending.gov",
  "gsa.gov",
];

const NOISE_HOST_SUFFIXES = [
  "google.com",
  "bing.com",
  "yahoo.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "youtube.com",
  "instagram.com",
  "reddit.com",
  "wikipedia.org",
  "indeed.com",
  "glassdoor.com",
];

function hostMatches(host: string, suffixes: readonly string[]): boolean {
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

function hostRank(host: string): number {
  if (hostMatches(host, PROCUREMENT_HOST_SUFFIXES)) return 2;
  if (host.endsWith(".gov") || host.endsWith(".edu")) return 1;
  return 0;
}

export function buildWatchSearchQueries(watch: Pick<RapidIqIntelWatch, "agency" | "keywords">): string[] {
  const org = watch.agency;
  const kw = watch.keywords.slice(0, 3).join(" OR ");
  const year = new Date().getFullYear();
  return [
    `"${org}" procurement bids RFP portal solicitations ${year} site:*.gov OR site:*.edu OR site:planetbids.com OR site:bonfirehub.com OR site:bidnet.com`,
    `"${org}" OR (${kw}) "request for proposal" OR "solicitation" "${year}" OR "${year + 1}" active open`,
  ];
}

export function extractAndRankDiscoveryUrls(
  text: string,
  existingUrls: Iterable<string>,
  maxUrls = 5,
): string[] {
  const existing = new Set(
    [...existingUrls].map((u) => {
      try {
        return new URL(u).href;
      } catch {
        return u;
      }
    }),
  );
  const raw = Array.from(new Set(text.match(URL_PATTERN) ?? []));
  const filtered = raw
    .map((u) => u.replace(/[.,;:'")\]]+$/, "").trim())
    .filter((u) => {
      try {
        const parsed = new URL(u);
        const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
        if (hostMatches(host, NOISE_HOST_SUFFIXES)) return false;
        return !existing.has(parsed.href);
      } catch {
        return false;
      }
    });

  filtered.sort((a, b) => {
    const ha = new URL(a).hostname.replace(/^www\./i, "").toLowerCase();
    const hb = new URL(b).hostname.replace(/^www\./i, "").toLowerCase();
    return hostRank(hb) - hostRank(ha);
  });

  return filtered.slice(0, maxUrls);
}

export type WatchDiscoveryResult = {
  watchId: string;
  queriesRun: number;
  discoveredUrls: string[];
  errors: string[];
  skipped: boolean;
};

function urlsFromModelText(text: string): string[] {
  const fromRegex = text.match(URL_PATTERN) ?? [];
  try {
    const parsed = JSON.parse(text) as { urls?: unknown };
    if (Array.isArray(parsed.urls)) {
      return [
        ...fromRegex,
        ...parsed.urls.filter((u): u is string => typeof u === "string"),
      ];
    }
  } catch {
    /* not JSON */
  }
  return fromRegex;
}

export async function discoverUrlsForWatch(watch: RapidIqIntelWatch): Promise<WatchDiscoveryResult> {
  const result: WatchDiscoveryResult = {
    watchId: watch.id,
    queriesRun: 0,
    discoveredUrls: [],
    errors: [],
    skipped: false,
  };

  if (watch.webSearchEnabled !== true) {
    result.skipped = true;
    return result;
  }
  if (!isRapidIqWebSearchEnabled() || isCollectorsMockEnabled()) {
    result.skipped = true;
    return result;
  }

  const existing = new Set(watch.sourceUrls);
  const discovered: string[] = [];

  for (const query of buildWatchSearchQueries(watch)) {
    const raw = await createJsonResponse({
      model: rapidIqModelClassification(),
      system:
        "You are a government procurement researcher. Find active procurement portal URLs and open bid/RFP listings for the named agency. Return JSON only.",
      jsonSchemaName: "rapid_iq_web_search_urls",
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          urls: { type: "array", items: { type: "string" } },
        },
        required: ["urls"],
      },
      user: query,
      webSearch: true,
    });
    result.queriesRun += 1;
    if (!raw) {
      result.errors.push(`web_search_empty query=${query.slice(0, 80)}`);
      continue;
    }
    const blob = urlsFromModelText(raw.text).join("\n");
    const urls = extractAndRankDiscoveryUrls(blob, existing, 5);
    for (const url of urls) {
      existing.add(url);
      discovered.push(url);
    }
  }

  result.discoveredUrls = [...new Set(discovered)];
  console.log(
    JSON.stringify({
      msg: "rapid_iq_web_search_discover",
      watchId: watch.id,
      queriesRun: result.queriesRun,
      discovered: result.discoveredUrls.length,
      errors: result.errors.length,
    }),
  );
  return result;
}
