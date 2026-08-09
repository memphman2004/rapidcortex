import {
  extractPdfText,
  findAgendaDocuments,
  isCollectorsMockEnabled,
} from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import type { Jurisdiction } from "../../../lib/rapid-iq/jurisdiction-registry.js";
import { SOURCE_SCORE_BOOSTS } from "../../../lib/rapid-iq/opportunity-scorer.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const OPENFEMA_BASE = "https://www.fema.gov/api/open/v2";

const FEMA_GRANT_KEYWORDS = [
  "emergency communications",
  "911",
  "psap",
  "public safety communications",
  "emergency notification",
  "first responder",
  "dispatch",
  "campus safety",
];

type FemaGrant = {
  id: string;
  programName: string;
  projectTitle: string;
  projectDescription: string;
  recipientName: string;
  recipientCity: string;
  recipientState: string;
  federalShareObligated: number;
  dateApproved: string;
  projectCounty: string;
};

const NTIA_SOURCES = [
  {
    name: "NTIA 911 Grant Program",
    url: "https://ntia.gov/category/911",
    pathHints: ["/category/911", "/grants/911"],
  },
  {
    name: "FCC 911 Grant Program",
    url: "https://www.fcc.gov/public-safety-homeland-security/policy-and-licensing-division/911-services/general/911-grant-program",
    pathHints: ["/911-grant-program", "/grant"],
  },
  {
    name: "USAC E-Rate — Emergency Connectivity",
    url: "https://www.usac.org/e-rate/",
    pathHints: ["/e-rate/", "/commitments", "/funding"],
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceAsJurisdiction(source: {
  name: string;
  url: string;
  pathHints: string[];
}): Jurisdiction {
  return {
    jurisdictionId: `ntia#${source.name}`,
    type: "state_agency",
    name: source.name,
    stateCode: "US",
    stateName: "United States",
    population: 0,
    tier: 2,
    tierWeight: 1,
    intervalHours: 168,
    agendaBaseUrl: source.url.replace(/\/$/, ""),
    agendaPathHints: source.pathHints,
    lastScannedAt: "",
    lastSignalAt: null,
    totalSignalsFound: 0,
    isActive: true,
    priorityBoost: 0,
    notes: null,
  };
}

function normalizeFemaGrants(payload: unknown, collectionKey: string): FemaGrant[] {
  const root = payload as Record<string, unknown>;
  const rows = (root?.[collectionKey] ?? root?.HazardMitigationAssistanceProjects ?? []) as unknown[];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const g = row as Record<string, unknown>;
    return {
      id: String(g.id ?? g.projectIdentifier ?? ""),
      programName: String(g.programName ?? g.programArea ?? "FEMA Hazard Mitigation"),
      projectTitle: String(g.projectTitle ?? g.title ?? ""),
      projectDescription: String(g.projectDescription ?? g.description ?? ""),
      recipientName: String(g.recipientName ?? g.subrecipientName ?? g.applicantName ?? ""),
      recipientCity: String(g.recipientCity ?? g.subrecipientCity ?? ""),
      recipientState: String(g.recipientState ?? g.subrecipientState ?? g.state ?? "").toUpperCase(),
      federalShareObligated: Number(g.federalShareObligated ?? g.projectAmount ?? 0),
      dateApproved: String(g.dateApproved ?? g.approvalDate ?? "").slice(0, 10),
      projectCounty: String(g.projectCounty ?? g.county ?? ""),
    };
  });
}

async function fetchFemaBricGrants(daysBack = 90): Promise<FemaGrant[]> {
  if (isCollectorsMockEnabled()) {
    return [
      {
        id: "mock-fema-bric-1",
        programName: "BRIC",
        projectTitle: "Emergency communications infrastructure upgrade",
        projectDescription:
          "County PSAP emergency communications and dispatch modernization for public safety answering point resilience.",
        recipientName: "Cobb County Emergency Management",
        recipientCity: "Marietta",
        recipientState: "GA",
        federalShareObligated: 1_200_000,
        dateApproved: new Date().toISOString().slice(0, 10),
        projectCounty: "Cobb",
      },
    ];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const endpoints = [
    "HazardMitigationGrantProgramProjectSummaries",
    "HazardMitigationAssistanceProjects",
  ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(`${OPENFEMA_BASE}/${endpoint}`);
      url.searchParams.set("$filter", `dateApproved ge '${cutoffStr}'`);
      url.searchParams.set(
        "$select",
        "id,programName,projectTitle,projectDescription,recipientName,recipientCity,recipientState,federalShareObligated,dateApproved,projectCounty",
      );
      url.searchParams.set("$top", "100");
      url.searchParams.set("$orderby", "dateApproved desc");

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const grants = normalizeFemaGrants(data, endpoint);
      if (grants.length > 0) return grants;
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

function matchesFemaKeywords(grant: FemaGrant): boolean {
  const text = `${grant.projectTitle} ${grant.projectDescription}`.toLowerCase();
  return FEMA_GRANT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

export async function runFemaGrantsCollector(): Promise<{ signalsFound: number }> {
  let total = 0;

  try {
    const bricGrants = await fetchFemaBricGrants(90);
    let matched = 0;

    for (const grant of bricGrants) {
      if (!matchesFemaKeywords(grant)) continue;
      matched++;

      const rawText = [
        `Grant Program: ${grant.programName}`,
        `Recipient: ${grant.recipientName}`,
        `Location: ${grant.recipientCity}, ${grant.recipientState} — ${grant.projectCounty} County`,
        `Project: ${grant.projectTitle}`,
        `Description: ${grant.projectDescription}`,
        `Federal Amount: $${Number(grant.federalShareObligated || 0).toLocaleString()}`,
        `Approved: ${grant.dateApproved}`,
        `Signal: This agency has approved federal funding for emergency communications or public safety infrastructure. They are active buyers.`,
      ].join("\n");

      const sourceUrl =
        "https://www.fema.gov/grants/mitigation/building-resilient-infrastructure-communities";

      const signal = await classifySignal(rawText, sourceUrl, "FEMA BRIC / HMGP");
      signal.isRelevant = true;
      signal.signalType = "grant";
      signal.state = signal.state ?? grant.recipientState;
      signal.agencyName = signal.agencyName ?? grant.recipientName;
      signal.city = signal.city ?? grant.recipientCity;
      signal.dollarValue = signal.dollarValue ?? grant.federalShareObligated;
      signal.intentStage = signal.intentStage ?? "evaluation";
      signal.scoreContrib = SOURCE_SCORE_BOOSTS.femaGrantAward;
      signal.tags = Array.from(new Set(["FEMA FUNDED", "GRANT FUNDING", ...(signal.tags ?? [])]));

      await upsertSignalAndOpportunity(
        signal,
        sourceUrl,
        grant.recipientName || "FEMA BRIC / HMGP",
        "grant_db",
        `fema_bric#${grant.recipientState || "US"}`,
      );
      total++;
    }

    console.log(
      JSON.stringify({
        msg: "fema_bric_grants_processed",
        totalRetrieved: bricGrants.length,
        keywordMatched: matched,
        signalsFound: total,
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "fema_bric_collector_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  for (const source of NTIA_SOURCES) {
    try {
      await sleep(2_000);
      const docs = await findAgendaDocuments(sourceAsJurisdiction(source));
      for (const doc of docs.slice(0, 5)) {
        const pdfText = await extractPdfText(doc.url);
        if (!pdfText) continue;
        const signal = await classifySignal(pdfText, doc.url, source.name);
        if (!signal.isRelevant) continue;

        signal.signalType = "grant";
        signal.scoreContrib = (signal.scoreContrib ?? 0) + SOURCE_SCORE_BOOSTS.ntiaGrant;
        signal.tags = Array.from(new Set(["NTIA GRANT", "GRANT FUNDING", ...(signal.tags ?? [])]));

        await upsertSignalAndOpportunity(
          signal,
          doc.url,
          source.name,
          "grant_db",
          "ntia#federal",
        );
        total++;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "ntia_collector_error",
          source: source.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(JSON.stringify({ msg: "fema_grants_collector_complete", signalsFound: total }));
  return { signalsFound: total };
}
