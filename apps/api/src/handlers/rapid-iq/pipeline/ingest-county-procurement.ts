/**
 * County procurement portal ingest — OpenGov, PlanetBids, DemandStar, BidNet, custom sites.
 * Rotating batches via DynamoDB cursor (same pattern as ingest-legistar-bulk).
 * EventBridge rate(2 hours) × 50 counties ≈ full crawlable set every ~32 hours.
 * State-portal rows and duplicate URLs are skipped in crawlableCountyProcurementEntries().
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isRelevantSignalText } from "rapid-cortex-shared";
import {
  crawlableCountyProcurementEntries,
  type CountyProcurementEntry,
} from "../../../lib/rapid-iq/county-procurement.js";
import { rapidIqIngestSinceDate } from "../../../lib/rapid-iq/ingest-window.js";
import { pipelineDdb } from "../../../lib/rapid-iq/pipeline-ddb.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const CURSOR_PK = "COUNTY#CURSOR";
const CURSOR_SK = "META";
const BATCH_SIZE = 50;
const FETCH_HEADERS = {
  "User-Agent": "RapidCortex-IQ/1.0 (procurement-monitor)",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
};

export function isCountyProcurementRelevant(text: string): boolean {
  return isRelevantSignalText(text);
}

function signalsTable(): string {
  const t = process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stripProcurementHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function readCursor(): Promise<number> {
  try {
    const res = await pipelineDdb.send(
      new GetCommand({
        TableName: signalsTable(),
        Key: { pk: CURSOR_PK, sk: CURSOR_SK },
      }),
    );
    const offset = res.Item?.offset;
    return typeof offset === "number" ? offset : 0;
  } catch {
    return 0;
  }
}

async function writeCursor(offset: number, total: number): Promise<void> {
  await pipelineDdb.send(
    new PutCommand({
      TableName: signalsTable(),
      Item: {
        pk: CURSOR_PK,
        sk: CURSOR_SK,
        offset,
        total,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}

async function queuePortalSignal(
  sourceUrl: string,
  title: string,
  snippet: string,
  signalDate: string,
  dedupeId: string,
): Promise<void> {
  const signal: RapidIqPipelineRawSignal = {
    sourceId: "county-procurement",
    sourceUrl,
    rawTitle: title.slice(0, 200),
    rawSnippet: snippet.slice(0, 4000),
    signalDate,
  };
  await enqueueRawSignal(signal, { dedupeId, groupId: "county-procurement" });
}

async function crawlOpenGov(entry: CountyProcurementEntry): Promise<number> {
  if (!entry.slug) return crawlHtmlListing(entry, entry.url);
  const portalUrl = `https://procurement.opengov.com/portal/${entry.slug}`;
  const params = new URLSearchParams({
    portal_slug: entry.slug,
    status: "open",
    published_after: rapidIqIngestSinceDate(),
    per_page: "30",
  });
  try {
    const apiRes = await fetch(`https://procurement.opengov.com/api/v1/opportunities?${params}`, {
      headers: { ...FETCH_HEADERS, Referer: portalUrl, "X-Requested-With": "XMLHttpRequest" },
      signal: AbortSignal.timeout(10_000),
    });
    if (apiRes.ok) {
      const data = (await apiRes.json()) as {
        opportunities?: Array<{
          id: string;
          title: string;
          description?: string;
          published_at?: string;
          closes_at?: string;
          status?: string;
        }>;
      };
      let queued = 0;
      for (const opp of data.opportunities ?? []) {
        const text = `${opp.title} ${opp.description ?? ""}`;
        if (!isCountyProcurementRelevant(text)) continue;
        await queuePortalSignal(
          `${portalUrl}/project/${opp.id}`,
          `[${entry.county}, ${entry.state} — OpenGov] ${opp.title}`,
          JSON.stringify({
            county: entry.county,
            state: entry.state,
            platform: "opengov",
            population: entry.pop,
            title: opp.title,
            description: (opp.description ?? "").slice(0, 1000),
            publishedAt: opp.published_at,
            closesAt: opp.closes_at,
            status: opp.status,
          }),
          opp.published_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          `opengov-${entry.slug}-${opp.id}`,
        );
        queued++;
      }
      return queued;
    }
  } catch {
    /* HTML fallback */
  }
  return crawlHtmlListing(entry, portalUrl);
}

async function crawlPlanetBids(entry: CountyProcurementEntry): Promise<number> {
  if (!entry.companyId) return crawlHtmlListing(entry, entry.url);
  const params = new URLSearchParams({
    CompanyId: entry.companyId,
    OpenDateFrom: rapidIqIngestSinceDate(),
    Status: "Open",
    PageSize: "30",
  });
  try {
    const res = await fetch(`https://pbsystem.planetbids.com/api/opportunities?${params}`, {
      headers: { ...FETCH_HEADERS, Referer: entry.url },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return crawlHtmlListing(entry, entry.url);
    const data = (await res.json()) as {
      Items?: Array<{
        BidId: number;
        BidTitle: string;
        BidDescription?: string;
        OpenDate?: string;
        CloseDate?: string;
      }>;
    };
    let queued = 0;
    for (const opp of data.Items ?? []) {
      const text = `${opp.BidTitle} ${opp.BidDescription ?? ""}`;
      if (!isCountyProcurementRelevant(text)) continue;
      await queuePortalSignal(
        `https://www.planetbids.com/vendor/opportunities/${opp.BidId}`,
        `[${entry.county}, ${entry.state} — PlanetBids] ${opp.BidTitle}`,
        JSON.stringify({
          county: entry.county,
          state: entry.state,
          platform: "planetbids",
          population: entry.pop,
          title: opp.BidTitle,
          description: (opp.BidDescription ?? "").slice(0, 1000),
          openDate: opp.OpenDate,
          closeDate: opp.CloseDate,
        }),
        opp.OpenDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        `planetbids-${entry.companyId}-${opp.BidId}`,
      );
      queued++;
    }
    return queued;
  } catch {
    return crawlHtmlListing(entry, entry.url);
  }
}

function customCandidateUrls(entry: CountyProcurementEntry): string[] {
  let origin = entry.url;
  try {
    origin = new URL(entry.url).origin;
  } catch {
    /* keep */
  }
  const given = entry.url.replace(/\/+$/, "");
  const extras = [
    `${given}/bids`,
    `${given}/rfps`,
    `${origin}/bids`,
    `${origin}/current-solicitations`,
    `${origin}/procurement`,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [given, ...extras]) {
    const k = u.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out.slice(0, 3);
}

async function crawlHtmlListing(
  entry: CountyProcurementEntry,
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<number> {
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return 0;
    const text = stripProcurementHtml(await res.text());
    if (!isCountyProcurementRelevant(text)) return 0;
    if (!/rfp|bid|solicitation|proposal|quote/i.test(text)) return 0;
    await queuePortalSignal(
      url,
      `[${entry.county}, ${entry.state} — ${entry.platform}] Public safety procurement`,
      `County: ${entry.county}, ${entry.state}\nPlatform: ${entry.platform}\nPopulation: ${entry.pop}\nURL: ${url}\n\n${text.slice(0, 1500)}`,
      new Date().toISOString().slice(0, 10),
      `county-${entry.platform}-${entry.state}-${entry.county.replace(/\s/g, "")}-${new Date().toISOString().slice(0, 7)}`,
    );
    return 1;
  } catch {
    return 0;
  }
}

async function crawlCustom(entry: CountyProcurementEntry): Promise<number> {
  for (const url of customCandidateUrls(entry)) {
    const queued = await crawlHtmlListing(entry, url);
    if (queued > 0) return queued;
    await sleep(300);
  }
  return 0;
}

export async function crawlCountyProcurementEntry(entry: CountyProcurementEntry): Promise<number> {
  switch (entry.platform) {
    case "opengov":
      return crawlOpenGov(entry);
    case "planetbids":
      return crawlPlanetBids(entry);
    case "custom":
    case "ionwave":
    case "periscope":
    case "publicpurchase":
      return crawlCustom(entry);
    case "demandstar":
      return crawlHtmlListing(entry, entry.url, { Referer: "https://www.demandstar.com" });
    case "bidnet":
      return crawlHtmlListing(entry, entry.url, { Referer: "https://www.bidnetdirect.com" });
    case "state-portal":
      return 0;
    default:
      return 0;
  }
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: county procurement ingest starting");

  if (await enqueueMockIfEnabled("county-procurement")) {
    console.log("Rapid IQ pipeline: county procurement mock path complete");
    return;
  }

  const counties = crawlableCountyProcurementEntries();
  if (counties.length === 0) {
    console.warn("County procurement: empty crawlable registry");
    return;
  }

  const cursor = await readCursor();
  const start = cursor % counties.length;
  const batch = counties.slice(start, start + BATCH_SIZE);
  const nextOffset = (start + BATCH_SIZE) % counties.length;

  console.log(
    JSON.stringify({
      msg: "county_procurement_batch",
      start,
      end: start + batch.length - 1,
      total: counties.length,
      states: [...new Set(batch.map((c) => c.state))].sort(),
    }),
  );

  let queued = 0;
  let errors = 0;
  for (const entry of batch) {
    try {
      const n = await crawlCountyProcurementEntry(entry);
      queued += n;
      const delay = entry.platform === "custom" ? 800 : 400;
      await sleep(delay);
    } catch (err) {
      errors++;
      console.warn(
        JSON.stringify({
          msg: "county_procurement_error",
          county: entry.county,
          state: entry.state,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  await writeCursor(nextOffset, counties.length);
  console.log(
    JSON.stringify({
      msg: "county_procurement_complete",
      queued,
      errors,
      nextCursor: nextOffset,
      total: counties.length,
    }),
  );
}
