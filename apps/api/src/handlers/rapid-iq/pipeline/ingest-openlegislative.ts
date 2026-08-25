/**
 * Legislative bill tracking for PSAP / 911 appropriations signals.
 * Prefers OpenStates when RAPID_IQ_OPENSTATES_API_KEY(_SECRET_ARN) is set.
 * Falls back to the provisioned LegiScan key used by the Rapid IQ collectors.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isRelevantSignalText, OPENSTATES_BILL_QUERIES, US_STATE_CODES } from "rapid-cortex-shared";
import { rapidIqIngestSinceDate } from "../../../lib/rapid-iq/ingest-window.js";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const OPENSTATES_BASE = "https://v3.openstates.org";
const LEGISCAN_BASE = "https://api.legiscan.com";

interface OpenStatesBill {
  id: string;
  identifier: string;
  title: string;
  abstract?: string;
  jurisdiction: {
    name: string;
    id: string;
  };
  session: string;
  created_at: string;
  updated_at: string;
  openstates_url: string;
  classification: string[];
}

const SEARCH_QUERIES = OPENSTATES_BILL_QUERIES;

/** All 50 states. OpenStates `q` is unscoped; LegiScan still needs per-state calls. */
const LEGISCAN_STATES = US_STATE_CODES;
const LEGISCAN_QUERIES = ["NG911", "PSAP", "emergency communications", "computer aided dispatch"];

async function resolveOpenStatesApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_OPENSTATES_API_KEY ?? process.env.OPENSTATES_API_KEY,
    process.env.RAPID_IQ_OPENSTATES_API_KEY_SECRET_ARN,
    { preferredField: "RAPID_IQ_OPENSTATES_API_KEY" },
  );
}

async function resolveLegiscanApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_LEGISCAN_API_KEY,
    process.env.RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchBills(query: string, apiKey: string): Promise<OpenStatesBill[]> {
  const params = new URLSearchParams({
    q: query,
    updated_since: rapidIqIngestSinceDate(),
    sort: "updated_desc",
    per_page: "20",
    apikey: apiKey,
  });

  const res = await fetch(`${OPENSTATES_BASE}/bills?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RapidCortex-IQ/1.0",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.warn(`OpenStates query "${query}": HTTP ${res.status}`);
    return [];
  }

  const data = (await res.json()) as { results?: OpenStatesBill[] };
  return data.results ?? [];
}

type LegiscanHit = {
  billId: string;
  billNumber: string;
  title: string;
  state: string;
  url: string;
  lastAction: string;
  lastActionDate: string;
};

function parseLegiscanSearch(data: unknown, state: string): LegiscanHit[] {
  const root = data as { searchresult?: Record<string, unknown> };
  const sr = root.searchresult;
  if (!sr || typeof sr !== "object") return [];
  const hits: LegiscanHit[] = [];
  for (const [key, value] of Object.entries(sr)) {
    if (key === "summary" || !value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const billId = String(row.bill_id ?? row.billId ?? "");
    if (!billId) continue;
    const billNumber = String(row.bill_number ?? row.number ?? billId);
    hits.push({
      billId,
      billNumber,
      title: String(row.title ?? billNumber),
      state: String(row.state ?? state),
      url:
        String(row.url ?? "").trim() ||
        `https://legiscan.com/${state}/bill/${billNumber.replace(/\s+/g, "")}`,
      lastAction: String(row.last_action ?? ""),
      lastActionDate: String(row.last_action_date ?? "").slice(0, 10),
    });
  }
  return hits;
}

async function searchLegiscan(
  query: string,
  state: string,
  apiKey: string,
): Promise<LegiscanHit[]> {
  const url = new URL(`${LEGISCAN_BASE}/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", "getSearch");
  url.searchParams.set("state", state);
  url.searchParams.set("query", query);
  url.searchParams.set("year", "2");

  await sleep(400);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.warn(`LegiScan ${state} "${query}": HTTP ${res.status}`);
    return [];
  }
  return parseLegiscanSearch(await res.json(), state);
}

async function ingestOpenStates(apiKey: string): Promise<number> {
  const seen = new Set<string>();
  let queued = 0;

  for (const query of SEARCH_QUERIES) {
    try {
      const bills = await searchBills(query, apiKey);

      for (const bill of bills) {
        if (seen.has(bill.id)) continue;
        if (!isRelevantSignalText(`${bill.identifier} ${bill.title} ${bill.abstract ?? ""}`)) continue;
        seen.add(bill.id);

        const signal: RapidIqPipelineRawSignal = {
          sourceId: "openlegislative",
          sourceUrl: bill.openstates_url,
          rawTitle:
            `[${bill.jurisdiction.name} Legislature] ${bill.identifier}: ${bill.title}`.slice(
              0,
              200,
            ),
          rawSnippet: JSON.stringify({
            state: bill.jurisdiction.name,
            billId: bill.identifier,
            title: bill.title,
            abstract: bill.abstract ?? "",
            session: bill.session,
            classification: bill.classification,
            updatedAt: bill.updated_at,
            url: bill.openstates_url,
          }),
          signalDate: bill.updated_at.slice(0, 10),
        };

        await enqueueRawSignal(signal, {
          dedupeId: `openstates-${bill.id}`,
          groupId: "openlegislative",
        });
        queued += 1;
      }

      await sleep(500);
    } catch (err) {
      console.error(`OpenStates query "${query}" failed:`, err);
    }
  }
  return queued;
}

async function ingestLegiscan(apiKey: string): Promise<number> {
  const cutoff = rapidIqIngestSinceDate();
  const seen = new Set<string>();
  let queued = 0;
  const deadline = Date.now() + 240_000;

  for (const state of LEGISCAN_STATES) {
    if (Date.now() > deadline) {
      console.warn("LegiScan ingest hit time budget — remaining states deferred to next run");
      break;
    }
    for (const query of LEGISCAN_QUERIES) {
      try {
        const bills = await searchLegiscan(query, state, apiKey);
        for (const bill of bills) {
          if (seen.has(bill.billId)) continue;
          if (bill.lastActionDate && bill.lastActionDate < cutoff) continue;
          if (!isRelevantSignalText(`${bill.billNumber} ${bill.title} ${bill.lastAction}`)) continue;
          seen.add(bill.billId);

          const signal: RapidIqPipelineRawSignal = {
            sourceId: "openlegislative",
            sourceUrl: bill.url,
            rawTitle: `[${bill.state} Legislature] ${bill.billNumber}: ${bill.title}`.slice(0, 200),
            rawSnippet: JSON.stringify({
              state: bill.state,
              billId: bill.billNumber,
              title: bill.title,
              lastAction: bill.lastAction,
              lastActionDate: bill.lastActionDate,
              url: bill.url,
              provider: "legiscan",
            }),
            signalDate: bill.lastActionDate || cutoff,
          };

          await enqueueRawSignal(signal, {
            dedupeId: `legiscan-${bill.billId}`,
            groupId: "openlegislative",
          });
          queued += 1;
        }
      } catch (err) {
        console.error(`LegiScan ${state} "${query}" failed:`, err);
      }
    }
  }
  return queued;
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: legislative ingestion starting");

  if (await enqueueMockIfEnabled("openlegislative")) {
    console.log("Rapid IQ pipeline: legislative mock path complete");
    return;
  }

  const openStatesKey = await resolveOpenStatesApiKey();
  if (openStatesKey) {
    const queued = await ingestOpenStates(openStatesKey);
    console.log(`OpenStates: queued ${queued} signals`);
    return;
  }

  const legiscanKey = await resolveLegiscanApiKey();
  if (legiscanKey) {
    const queued = await ingestLegiscan(legiscanKey);
    console.log(`LegiScan: queued ${queued} signals`);
    return;
  }

  console.warn(
    "Legislative ingest skipped — set RAPID_IQ_OPENSTATES_API_KEY_SECRET_ARN or RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN",
  );
}
