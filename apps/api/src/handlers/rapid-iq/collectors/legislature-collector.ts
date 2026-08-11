import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import {
  LEGISLATURE_QUERIES,
  LEGISLATURE_STATES_PER_RUN,
  type LegislatureQuery,
} from "../../../lib/rapid-iq/legislature-keywords.js";
import { SOURCE_SCORE_BOOSTS } from "../../../lib/rapid-iq/opportunity-scorer.js";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const LEGISCAN_BASE = "https://api.legiscan.com";

type LegiscanBill = {
  bill_id: number;
  bill_number: string;
  title: string;
  description: string;
  state: string;
  status: number;
  url: string;
  last_action: string;
  last_action_date: string;
  /** Optional text document id when present on monitor/search payloads. */
  text_id?: number | null;
};

let cachedApiKey: string | null = null;

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const key = await resolvePlainOrSecretArn(
    process.env.RAPID_IQ_LEGISCAN_API_KEY,
    process.env.RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  cachedApiKey = key.trim();
  return cachedApiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function billStatusLabel(status: number): string {
  return ["", "Introduced", "Engrossed", "Enrolled", "Passed", "Vetoed"][status] ?? "Unknown";
}

function buildBillText(bill: LegiscanBill, extra = ""): string {
  return [
    `State: ${bill.state}`,
    `Bill Number: ${bill.bill_number}`,
    `Title: ${bill.title}`,
    `Description: ${bill.description}`,
    `Status: ${billStatusLabel(bill.status)}`,
    `Last Action: ${bill.last_action} (${bill.last_action_date})`,
    `Source URL: ${bill.url}`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function inferVertical(bill: LegiscanBill): LegislatureQuery["vertical"] {
  const hay = `${bill.title} ${bill.description}`.toLowerCase();
  for (const q of LEGISLATURE_QUERIES) {
    const tokens = q.query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    if (tokens.some((t) => hay.includes(t))) return q.vertical;
  }
  if (/campus|university|clery|college/.test(hay)) return "campus";
  if (/venue|stadium|arena|event safety/.test(hay)) return "venue";
  return "911";
}

function normalizeBill(raw: unknown, fallbackState = ""): LegiscanBill | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const billId = Number(b.bill_id ?? 0);
  const billNumber = String(b.bill_number ?? b.number ?? "").trim();
  const title = String(b.title ?? "").trim();
  if (!billId && !billNumber && !title) return null;
  const state = String(b.state ?? fallbackState).toUpperCase();
  const textIdRaw = b.text_id ?? b.doc_id ?? null;
  return {
    bill_id: billId,
    bill_number: billNumber || `BILL-${billId}`,
    title: title || billNumber,
    description: String(b.description ?? b.title ?? ""),
    state,
    status: Number(b.status ?? 1),
    url:
      String(b.url ?? "").trim() ||
      `https://legiscan.com/${state}/bill/${billNumber.replace(/\s+/g, "")}`,
    last_action: String(b.last_action ?? ""),
    last_action_date: String(b.last_action_date ?? "").slice(0, 10),
    text_id: textIdRaw != null && Number(textIdRaw) > 0 ? Number(textIdRaw) : null,
  };
}

function parseSearchResults(data: unknown, state: string): LegiscanBill[] {
  const root = data as {
    status?: string;
    searchresult?: Record<string, unknown> | { results?: unknown[] };
  };
  if (root.status && root.status !== "OK") {
    console.warn(
      JSON.stringify({
        msg: "legiscan_search_status",
        status: root.status,
        state,
      }),
    );
  }
  const sr = root?.searchresult;
  if (!sr || typeof sr !== "object") return [];

  if (Array.isArray((sr as { results?: unknown[] }).results)) {
    return ((sr as { results: unknown[] }).results ?? [])
      .map((r) => normalizeBill(r, state))
      .filter((b): b is LegiscanBill => Boolean(b));
  }

  const bills: LegiscanBill[] = [];
  for (const [key, value] of Object.entries(sr)) {
    if (key === "summary" || !value || typeof value !== "object") continue;
    const bill = normalizeBill(value, state);
    if (bill) bills.push(bill);
  }
  return bills;
}

function parseMonitorList(data: unknown): LegiscanBill[] {
  const root = data as {
    status?: string;
    monitorlist?: Record<string, unknown> | unknown[];
  };
  if (root.status && root.status !== "OK") {
    console.warn(
      JSON.stringify({
        msg: "legiscan_monitor_status",
        status: root.status,
      }),
    );
  }
  const list = root.monitorlist;
  if (!list) return [];
  if (Array.isArray(list)) {
    return list.map((r) => normalizeBill(r)).filter((b): b is LegiscanBill => Boolean(b));
  }
  if (typeof list === "object") {
    return Object.values(list)
      .map((r) => normalizeBill(r))
      .filter((b): b is LegiscanBill => Boolean(b));
  }
  return [];
}

/** PRIMARY — one query returns all monitored bills (configure monitors in LegiScan UI). */
async function getMonitoredBills(): Promise<LegiscanBill[]> {
  const apiKey = await getApiKey();
  if (!apiKey) return [];

  const url = new URL(`${LEGISCAN_BASE}/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", "getMonitorListRaw");
  url.searchParams.set("record", "current");

  await sleep(500);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.warn(
      JSON.stringify({ msg: "legiscan_monitor_http_error", status: res.status }),
    );
    return [];
  }
  const data: unknown = await res.json();
  return parseMonitorList(data);
}

/** SUPPLEMENTAL — op must be getSearch (not "search"). */
async function searchBills(query: string, state: string): Promise<LegiscanBill[]> {
  const apiKey = await getApiKey();
  if (!apiKey) return [];

  const url = new URL(`${LEGISCAN_BASE}/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", "getSearch");
  url.searchParams.set("state", state);
  url.searchParams.set("query", query);
  url.searchParams.set("year", "2");

  await sleep(500);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return parseSearchResults(data, state);
}

/**
 * ON DEMAND — full bill text. LegiScan returns Base64 in `text.doc`.
 * Use sparingly for high-status bills (status >= 3).
 */
async function getBillText(textId: number): Promise<string | null> {
  const apiKey = await getApiKey();
  if (!apiKey || !textId) return null;

  const url = new URL(`${LEGISCAN_BASE}/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", "getBillText");
  url.searchParams.set("id", String(textId));

  await sleep(500);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;

  const data = (await res.json()) as { text?: { doc?: string } };
  const encoded = data?.text?.doc ?? "";
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf-8").slice(0, 5000);
  } catch {
    return null;
  }
}

async function processBill(
  bill: LegiscanBill,
  vertical: LegislatureQuery["vertical"],
  sourceLabel: string,
): Promise<boolean> {
  const cutoff = ninetyDaysAgo();
  // Keep introduced-only bills only when recently active.
  if (bill.status < 2 && bill.last_action_date && bill.last_action_date < cutoff) {
    return false;
  }

  let extra = "";
  if (bill.status >= 3 && bill.text_id) {
    const full = await getBillText(bill.text_id);
    if (full) extra = `Bill Text (excerpt):\n${full}`;
  }

  const statusBoost = bill.status >= 2 ? 4 : 0;
  const rawText = buildBillText(bill, extra);
  const signal = await classifySignal(rawText, bill.url, sourceLabel);
  if (!signal.isRelevant) return false;

  signal.signalType = signal.signalType ?? "budget";
  signal.vertical = vertical;
  signal.state = signal.state ?? bill.state;
  signal.tags = Array.from(new Set(["STATE BILL", ...(signal.tags ?? [])]));
  signal.scoreContrib =
    (signal.scoreContrib ?? 0) + SOURCE_SCORE_BOOSTS.stateLegislatureBill + statusBoost;

  if (!signal.agencyName?.trim()) return false;

  const result = await upsertSignalAndOpportunity(
    signal,
    bill.url,
    `${bill.state || "State"} Legislature`,
    "government_doc",
    `legislature#${bill.state || "XX"}`,
  );
  return result.saved;
}

export async function runLegislatureCollector(): Promise<{ signalsFound: number }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn(
      JSON.stringify({
        msg: "legislature_collector_skipped",
        reason: "RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN (or RAPID_IQ_LEGISCAN_API_KEY) not set",
      }),
    );
    return { signalsFound: 0 };
  }

  let total = 0;
  const seenBillIds = new Set<number>();

  // ── STEP 1: Poll monitored bills (PRIMARY — typically 1 query) ──────────
  try {
    const monitoredBills = await getMonitoredBills();
    console.log(
      JSON.stringify({
        msg: "legiscan_monitor_polled",
        billsReturned: monitoredBills.length,
      }),
    );

    for (const bill of monitoredBills) {
      if (bill.bill_id) seenBillIds.add(bill.bill_id);
      try {
        const saved = await processBill(
          bill,
          inferVertical(bill),
          `${bill.state} State Legislature`,
        );
        if (saved) total++;
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "legiscan_monitor_bill_error",
            billId: bill.bill_id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "legiscan_monitor_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  // ── STEP 2: Keyword search by state (SUPPLEMENTAL) ─────────────────────
  for (const state of LEGISLATURE_STATES_PER_RUN) {
    for (const { query, vertical } of LEGISLATURE_QUERIES) {
      try {
        const bills = await searchBills(query, state);

        for (const bill of bills.slice(0, 3)) {
          if (bill.bill_id && seenBillIds.has(bill.bill_id)) continue;
          if (bill.bill_id) seenBillIds.add(bill.bill_id);

          const saved = await processBill(bill, vertical, `${state} State Legislature`);
          if (saved) total++;
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "legislature_search_error",
            state,
            query,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  console.log(JSON.stringify({ msg: "legislature_collector_complete", signalsFound: total }));
  return { signalsFound: total };
}

/** Test helper */
export function clearLegiscanApiKeyCacheForTests(): void {
  cachedApiKey = null;
}
