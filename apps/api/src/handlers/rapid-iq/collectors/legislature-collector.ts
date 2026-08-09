import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import {
  LEGISLATURE_QUERIES,
  LEGISLATURE_STATES_PER_RUN,
} from "../../../lib/rapid-iq/legislature-keywords.js";
import { SOURCE_SCORE_BOOSTS } from "../../../lib/rapid-iq/opportunity-scorer.js";
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
};

function legiscanApiKey(): string {
  return process.env.RAPID_IQ_LEGISCAN_API_KEY?.trim() ?? "";
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

function parseSearchResults(data: unknown): LegiscanBill[] {
  const root = data as {
    searchresult?: Record<string, unknown> | { results?: unknown[] };
  };
  const sr = root?.searchresult;
  if (!sr || typeof sr !== "object") return [];

  if (Array.isArray((sr as { results?: unknown[] }).results)) {
    return ((sr as { results: unknown[] }).results ?? [])
      .map(normalizeBill)
      .filter((b): b is LegiscanBill => Boolean(b));
  }

  const bills: LegiscanBill[] = [];
  for (const [key, value] of Object.entries(sr)) {
    if (key === "summary" || !value || typeof value !== "object") continue;
    const bill = normalizeBill(value);
    if (bill) bills.push(bill);
  }
  return bills;
}

function normalizeBill(raw: unknown): LegiscanBill | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const billId = Number(b.bill_id ?? 0);
  const billNumber = String(b.bill_number ?? b.number ?? "").trim();
  const title = String(b.title ?? "").trim();
  if (!billId && !billNumber && !title) return null;
  const state = String(b.state ?? "").toUpperCase();
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
  };
}

async function searchBills(query: string, state: string): Promise<LegiscanBill[]> {
  const key = legiscanApiKey();
  if (!key) return [];

  const url = new URL(`${LEGISCAN_BASE}/`);
  url.searchParams.set("key", key);
  url.searchParams.set("op", "search");
  url.searchParams.set("state", state);
  url.searchParams.set("query", query);
  url.searchParams.set("year", "2");

  await sleep(500);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return parseSearchResults(data);
}

export async function runLegislatureCollector(): Promise<{ signalsFound: number }> {
  if (!legiscanApiKey()) {
    console.warn(
      JSON.stringify({
        msg: "legislature_collector_skipped",
        reason: "RAPID_IQ_LEGISCAN_API_KEY not set",
      }),
    );
    return { signalsFound: 0 };
  }

  let total = 0;
  const cutoff = ninetyDaysAgo();

  for (const state of LEGISLATURE_STATES_PER_RUN) {
    for (const { query, vertical } of LEGISLATURE_QUERIES) {
      try {
        const bills = await searchBills(query, state);

        for (const bill of bills.slice(0, 5)) {
          // Keep introduced-only bills only when recently active.
          if (bill.status < 2 && bill.last_action_date && bill.last_action_date < cutoff) {
            continue;
          }

          const statusBoost = bill.status >= 2 ? 4 : 0;
          const rawText = [
            `State: ${bill.state || state}`,
            `Bill: ${bill.bill_number}`,
            `Title: ${bill.title}`,
            `Description: ${bill.description}`,
            `Status: ${billStatusLabel(bill.status)}`,
            `Last Action: ${bill.last_action} (${bill.last_action_date})`,
            `Vertical hint: ${vertical}`,
          ].join("\n");

          const signal = await classifySignal(rawText, bill.url, `${state} State Legislature`);
          if (!signal.isRelevant) continue;

          signal.signalType = signal.signalType ?? "budget";
          signal.vertical = vertical;
          signal.state = signal.state ?? state;
          signal.tags = Array.from(new Set(["STATE BILL", ...(signal.tags ?? [])]));
          signal.scoreContrib =
            (signal.scoreContrib ?? 0) + SOURCE_SCORE_BOOSTS.stateLegislatureBill + statusBoost;

          await upsertSignalAndOpportunity(
            signal,
            bill.url,
            `${state} Legislature`,
            "government_doc",
            `legislature#${state}`,
          );
          total++;
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "legislature_collector_error",
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
