/**
 * OpenStates legislative bill tracking for PSAP / 911 appropriations signals.
 * Requires RAPID_IQ_OPENSTATES_API_KEY or RAPID_IQ_OPENSTATES_API_KEY_SECRET_ARN.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const OPENSTATES_BASE = "https://v3.openstates.org";

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

const SEARCH_QUERIES = [
  "911 dispatch technology",
  "PSAP grant",
  "emergency communications center",
  "computer aided dispatch",
  "911 fund appropriation",
  "public safety answering point",
  "next generation 911",
  "NG911 implementation",
  "emergency communications technology",
];

async function resolveOpenStatesApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_OPENSTATES_API_KEY ?? process.env.OPENSTATES_API_KEY,
    process.env.RAPID_IQ_OPENSTATES_API_KEY_SECRET_ARN,
    { preferredField: "RAPID_IQ_OPENSTATES_API_KEY" },
  );
}

async function searchBills(query: string, apiKey: string): Promise<OpenStatesBill[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const params = new URLSearchParams({
    q: query,
    updated_since: thirtyDaysAgo.toISOString().slice(0, 10),
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

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: OpenStates legislative ingestion starting");

  if (await enqueueMockIfEnabled("openlegislative")) {
    console.log("Rapid IQ pipeline: OpenStates mock path complete");
    return;
  }

  const apiKey = await resolveOpenStatesApiKey();
  if (!apiKey) {
    console.warn("OPENSTATES API key not set — skipping OpenStates ingestion");
    return;
  }

  const seen = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    try {
      const bills = await searchBills(query, apiKey);

      for (const bill of bills) {
        if (seen.has(bill.id)) continue;
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
      }

      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`OpenStates query "${query}" failed:`, err);
    }
  }

  console.log("Rapid IQ pipeline: OpenStates ingestion complete");
}
