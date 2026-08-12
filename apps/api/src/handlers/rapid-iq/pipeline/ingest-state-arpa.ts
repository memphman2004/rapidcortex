/**
 * Treasury SLFRF + state ARPA dashboard ingestion.
 * Includes Idaho dfm.idaho.gov/arpa (Jefferson County coverage).
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
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

const PSAP_CATEGORY_KEYWORDS = [
  "public safety",
  "emergency communications",
  "911",
  "dispatch",
  "PSAP",
  "law enforcement technology",
  "first responder",
  "communications infrastructure",
  "broadband",
];

const VENDOR_MENTIONS = [
  "Tyler Technologies",
  "Motorola",
  "CentralSquare",
  "Hexagon",
  "L3Harris",
  "Zetron",
];

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return [...PSAP_CATEGORY_KEYWORDS, ...VENDOR_MENTIONS].some((kw) =>
    lower.includes(kw.toLowerCase()),
  );
}

async function fetchTreasurySlfrf(): Promise<void> {
  const params = new URLSearchParams({
    $where:
      `category like '%public safety%' OR category like '%emergency communications%' OR description like '%911%' OR description like '%dispatch%'`,
    $limit: "200",
    $order: "reported_date DESC",
  });

  const url = `https://data.cdc.gov/resource/slfrf-projects.json?${params}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RapidCortex-IQ/1.0" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn(`Treasury SLFRF: HTTP ${res.status}`);
      return;
    }

    const projects = (await res.json()) as Record<string, string>[];

    for (const project of projects) {
      const description = project.description ?? project.project_name ?? "";
      const recipient = project.recipient_name ?? project.entity_name ?? "";
      const amount = project.award_amount ?? project.obligation_amount ?? "0";
      const date = project.reported_date ?? project.award_date ?? new Date().toISOString();
      const state = project.recipient_state ?? project.state ?? "";

      if (!isRelevant(`${description} ${recipient}`)) continue;

      const signal: RapidIqPipelineRawSignal = {
        sourceId: "state-arpa",
        sourceUrl:
          "https://home.treasury.gov/policy-issues/coronavirus/assistance-for-state-local-and-tribal-governments/state-and-local-fiscal-recovery-funds",
        rawTitle: `[Treasury SLFRF - ${state}] ${recipient} — ${description.slice(0, 80)}`,
        rawSnippet: JSON.stringify({
          source: "Treasury SLFRF",
          recipient,
          description,
          amount,
          state,
          date,
          category: project.category ?? project.expenditure_category ?? "",
        }),
        signalDate: date.slice(0, 10),
      };

      await enqueueRawSignal(signal, {
        dedupeId: `slfrf-${recipient}-${description}-${date}`,
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
      headers: { "User-Agent": "RapidCortex-IQ/1.0" },
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
