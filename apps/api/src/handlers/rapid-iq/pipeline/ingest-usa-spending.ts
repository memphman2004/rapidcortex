/**
 * USASpending.gov ingestion — queues public-safety-relevant federal awards.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isRelevantSignalText } from "rapid-cortex-shared";
import { rapidIqIngestSinceDate } from "../../../lib/rapid-iq/ingest-window.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const TARGET_CFDA = [
  "16.710", // COPS Technology
  "97.067", // Homeland Security Grant Program
  "97.044", // FIRE Act Grants
  "16.738", // Edward Byrne Memorial JAG
  "97.088",
];

type AwardRow = Record<string, unknown>;

function field(row: AwardRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null) return row[k];
  }
  return undefined;
}

/** Grant (non-loan assistance) field names accepted by spending_by_award. */
export function buildUsaSpendingSearchBody(today = new Date()) {
  return {
    filters: {
      time_period: [
        {
          start_date: rapidIqIngestSinceDate(today),
          end_date: today.toISOString().slice(0, 10),
        },
      ],
      award_type_codes: ["02", "03", "04", "05"],
      program_numbers: TARGET_CFDA,
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Description",
      "Award Amount",
      "Start Date",
      "Last Modified Date",
      "generated_internal_id",
      "recipient_location_state_code",
    ],
    page: 1,
    limit: 100,
    sort: "Last Modified Date",
    order: "desc" as const,
  };
}

async function fetchRecentAwards(): Promise<AwardRow[]> {
  const body = buildUsaSpendingSearchBody();

  const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`USASpending API error ${res.status}`);
  }

  const data = (await res.json()) as { results?: AwardRow[] };
  return data.results ?? [];
}

function isRelevant(description: string): boolean {
  return isRelevantSignalText(description);
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: USASpending ingestion starting");

  if (await enqueueMockIfEnabled("usa-spending")) {
    console.log("Rapid IQ pipeline: USASpending mock path complete");
    return;
  }

  let awards: AwardRow[];
  try {
    awards = await fetchRecentAwards();
  } catch (err) {
    console.error("USASpending fetch failed:", err);
    return;
  }

  const relevant = awards.filter((a) =>
    isRelevant(String(field(a, "Description", "description") ?? "")),
  );
  console.log(`USASpending: ${awards.length} awards → ${relevant.length} relevant`);

  for (const award of relevant) {
    const awardId = String(
      field(award, "generated_internal_id", "Award ID", "id", "generated_unique_award_id") ??
        "unknown",
    );
    const description = String(field(award, "Description", "description") ?? "");
    const recipient = String(field(award, "Recipient Name", "recipient_name") ?? "Unknown");
    const amount = field(award, "Award Amount", "total_obligation", "amount");
    const actionDate = String(
      field(
        award,
        "Last Modified Date",
        "Start Date",
        "Action Date",
        "date_signed",
        "action_date",
      ) ?? new Date().toISOString().slice(0, 10),
    ).slice(0, 10);
    const state = field(
      award,
      "recipient_location_state_code",
      "Recipient State Code",
      "recipient_state_code",
    );

    const signal: RapidIqPipelineRawSignal = {
      sourceId: "usa-spending",
      sourceUrl: `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}`,
      rawTitle: `Federal Award: ${description.slice(0, 120)} — ${recipient}`,
      rawSnippet: JSON.stringify({
        recipient,
        description,
        amount,
        state,
        dateSigned: actionDate,
      }),
      signalDate: actionDate,
    };

    await enqueueRawSignal(signal, { dedupeId: `usa-spending-${awardId}` });
  }

  console.log(`USASpending: queued ${relevant.length} signals`);
}
