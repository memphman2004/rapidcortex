/**
 * Treasury SLFRF + state ARPA dashboard ingestion.
 * Includes Idaho dfm.idaho.gov/arpa (Jefferson County coverage).
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isCivicDocumentIngestText } from "rapid-cortex-shared";
import { rapidIqIngestSinceDate } from "../../../lib/rapid-iq/ingest-window.js";
import { RAPID_IQ_BROWSER_UA } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

interface ArpaSource {
  state: string;
  stateName: string;
  dashboardUrl: string;
  apiUrl?: string;
  format: "socrata" | "html" | "pdf" | "xlsx" | "api";
  notes?: string;
}

const ARPA_SOURCES: ArpaSource[] = [
  {
    state: "TX",
    stateName: "Texas",
    dashboardUrl: "https://comptroller.texas.gov/programs/arpa/",
    apiUrl: "https://data.texas.gov/resource/arpa-spending.json",
    format: "socrata",
  },
  {
    state: "FL",
    stateName: "Florida",
    dashboardUrl: "https://floridajobs.org/floridastrong/arpa",
    format: "html",
  },
  {
    state: "GA",
    stateName: "Georgia",
    dashboardUrl: "https://opb.georgia.gov/budget-report/arpa-tracker",
    format: "html",
  },
  {
    state: "NC",
    stateName: "North Carolina",
    dashboardUrl: "https://www.osbm.nc.gov/arpa/local-government-recovery",
    apiUrl: "https://data.nc.gov/resource/arpa-local.json",
    format: "socrata",
  },
  {
    state: "VA",
    stateName: "Virginia",
    dashboardUrl: "https://www.finance.virginia.gov/arpa/",
    format: "html",
  },
  {
    state: "CO",
    stateName: "Colorado",
    dashboardUrl: "https://oedit.colorado.gov/arpa-tracker",
    format: "html",
  },
  {
    state: "WA",
    stateName: "Washington",
    dashboardUrl: "https://ofm.wa.gov/sites/default/files/public/budget/statebudget/arpa/",
    format: "html",
  },
  {
    state: "MN",
    stateName: "Minnesota",
    dashboardUrl: "https://mn.gov/mmb/arpa/",
    format: "html",
  },
  {
    state: "OH",
    stateName: "Ohio",
    dashboardUrl: "https://obm.ohio.gov/arpa",
    format: "html",
  },
  {
    state: "MI",
    stateName: "Michigan",
    dashboardUrl: "https://www.michigan.gov/budget/fiscal/federal-funds/arpa",
    format: "html",
  },
  {
    state: "ID",
    stateName: "Idaho",
    dashboardUrl: "https://dfm.idaho.gov/arpa/",
    format: "html",
    notes: "Idaho ARPA tracker — would catch Jefferson County allocations",
  },
];

function isRelevant(text: string): boolean {
  return isCivicDocumentIngestText(text);
}

async function fetchTreasurySlfrf(): Promise<void> {
  const today = new Date();
  const body = {
    filters: {
      time_period: [
        {
          start_date: rapidIqIngestSinceDate(today),
          end_date: today.toISOString().slice(0, 10),
        },
      ],
      award_type_codes: ["02", "03", "04", "05"],
      program_numbers: ["21.027"],
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

  try {
    const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": RAPID_IQ_BROWSER_UA },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn(`Treasury SLFRF (USASpending 21.027): HTTP ${res.status}`);
      return;
    }

    const payload = (await res.json()) as { results?: Record<string, unknown>[] };
    const projects = payload.results ?? [];
    console.log(`SLFRF: ${projects.length} USASpending 21.027 awards`);

    for (const project of projects) {
      const description = String(project.Description ?? project.description ?? "");
      const recipient = String(project["Recipient Name"] ?? project.recipient_name ?? "");
      const hay = `${description} ${recipient}`;
      if (!isRelevant(hay) && !/\b(911|dispatch|psap|ng911|emergency communications)\b/i.test(hay)) {
        continue;
      }
      const amount = project["Award Amount"] ?? project.award_amount ?? "0";
      const date = String(
        project["Last Modified Date"] ?? project["Start Date"] ?? new Date().toISOString(),
      );
      const state = String(
        project.recipient_location_state_code ?? project["Recipient State Code"] ?? "",
      );
      const awardId = String(project.generated_internal_id ?? project["Award ID"] ?? "unknown");

      const signal: RapidIqPipelineRawSignal = {
        sourceId: "state-arpa",
        sourceUrl: `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}`,
        rawTitle: `[Treasury SLFRF - ${state}] ${recipient} — ${description.slice(0, 80)}`,
        rawSnippet: JSON.stringify({
          source: "USASpending CFDA 21.027",
          recipient,
          description,
          amount,
          state,
          date,
        }),
        signalDate: date.slice(0, 10),
      };

      await enqueueRawSignal(signal, {
        dedupeId: `slfrf-${awardId}`,
        groupId: "state-arpa",
      });
    }
  } catch (err) {
    console.error("Treasury SLFRF fetch failed:", err);
  }
}

async function crawlArpaDashboard(source: ArpaSource): Promise<void> {
  try {
    const res = await fetch(source.dashboardUrl, {
      headers: { "User-Agent": RAPID_IQ_BROWSER_UA },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`ARPA dashboard ${source.state}: HTTP ${res.status}`);
      return;
    }

    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!isRelevant(text)) return;

    const signal: RapidIqPipelineRawSignal = {
      sourceId: "state-arpa",
      sourceUrl: source.dashboardUrl,
      rawTitle: `[${source.stateName} ARPA Dashboard] Public Safety Technology Spending`,
      rawSnippet: `State: ${source.stateName}\nURL: ${source.dashboardUrl}\n\nContent:\n${text.slice(0, 2000)}`,
      signalDate: new Date().toISOString().slice(0, 10),
    };

    await enqueueRawSignal(signal, {
      dedupeId: `arpa-html-${source.state}-${new Date().toISOString().slice(0, 7)}`,
      groupId: "state-arpa",
    });
  } catch (err) {
    console.warn(`ARPA dashboard ${source.state}:`, (err as Error).message);
  }
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: State ARPA ingestion starting");

  if (await enqueueMockIfEnabled("state-arpa")) {
    console.log("Rapid IQ pipeline: State ARPA mock path complete");
    return;
  }

  await fetchTreasurySlfrf();

  for (const source of ARPA_SOURCES) {
    await crawlArpaDashboard(source);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Rapid IQ pipeline: State ARPA ingestion complete");
}
