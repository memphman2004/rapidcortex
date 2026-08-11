import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const GRANT_KEYWORDS = [
  "NG911",
  "PSAP",
  "emergency communications",
  "public safety communications",
  "911 grant",
];

type GrantHit = {
  id?: string | number;
  number?: string;
  title?: string;
  agencyName?: string;
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  synopsis?: string;
};

export async function runGrantsGovCollector(): Promise<{ signalsFound: number }> {
  if (isCollectorsMockEnabled()) {
    const classified = await classifySignal(
      "Grants.gov: NG911 grant funding opportunity for PSAPs and emergency communications. Eligible agencies may apply for public safety technology modernization.",
      "https://www.grants.gov/search-results-detail/mock-rapid-iq",
      "Grants.gov",
    );
    classified.signalType = "grant";
    classified.tags = ["GRANT FUNDING", "NG911", "OPPORTUNITY"];
    classified.agencyName = "Mock County 911";
    classified.city = "Mockville";
    classified.state = "AL";
    classified.aiSummary = [
      'Grants.gov NOFO "NG911 modernization" lists Mock County 911 as an eligible applicant class example.',
      "Estimated award band $250,000 for PSAP communications upgrades.",
      "Rapid Cortex Core maps to NG911 recording and AI coaching funded by this opportunity class.",
      "Outreach before the mock close date while applications are open.",
    ].join(" ");
    if (classified.isRelevant) {
      const result = await upsertSignalAndOpportunity(
        classified,
        "https://www.grants.gov/search-results-detail/mock-rapid-iq",
        "Grants.gov",
        "grants_gov",
        "state_agency#US#grants",
      );
      return { signalsFound: result.saved ? 1 : 0 };
    }
    return { signalsFound: 0 };
  }

  let total = 0;
  try {
    for (const keyword of GRANT_KEYWORDS) {
      const res = await fetch("https://api.grants.gov/v1/api/search2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keyword,
          oppStatuses: "posted|forecasted",
          rows: 10,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        console.warn(
          JSON.stringify({
            msg: "grants_gov_search_http_error",
            keyword,
            status: res.status,
          }),
        );
        continue;
      }
      const body = (await res.json()) as {
        data?: { oppHits?: GrantHit[] };
        oppHits?: GrantHit[];
      };
      const hits = body.data?.oppHits ?? body.oppHits ?? [];
      for (const hit of hits.slice(0, 5)) {
        const oppNumber = hit.number ?? String(hit.id ?? "");
        const detailUrl = oppNumber
          ? `https://www.grants.gov/search-results-detail/${encodeURIComponent(oppNumber)}`
          : "https://www.grants.gov";
        const text = [
          `Grants.gov opportunity: ${hit.title ?? "Untitled"}`,
          `Agency: ${hit.agencyName ?? hit.agencyCode ?? "Federal"}`,
          `Status: ${hit.oppStatus ?? "posted"}`,
          `Open: ${hit.openDate ?? "n/a"} Close: ${hit.closeDate ?? "n/a"}`,
          hit.synopsis ?? "",
          "Public safety / 911 / emergency communications grant funding signal.",
        ].join("\n");

        const classified = await classifySignal(text, detailUrl, "Grants.gov");
        // Do not invent a buyer from the Grants.gov platform label. Only persist when
        // the classifier extracted a concrete eligible agency from the opportunity text.
        if (!classified.isRelevant || !classified.agencyName?.trim()) continue;
        const agencyLower = classified.agencyName.toLowerCase();
        if (
          agencyLower.includes("grants.gov") ||
          agencyLower === "grants.gov opportunity" ||
          agencyLower === (hit.agencyName ?? "").toLowerCase()
        ) {
          // Federal awarding agency alone is not a Rapid IQ buyer opportunity
          continue;
        }
        classified.signalType = classified.signalType ?? "grant";
        classified.tags = Array.from(
          new Set(["GRANT FUNDING", "NG911", "OPPORTUNITY", ...(classified.tags ?? [])]),
        );
        classified.scoreContrib = Math.max(classified.scoreContrib ?? 0, 22);
        classified.sourceDocUrl = detailUrl;
        if (!classified.aiSummary?.trim()) {
          classified.aiSummary = [
            `Grants.gov opportunity "${hit.title ?? "Untitled"}" (${hit.number ?? "n/a"}) names ${classified.agencyName} in connection with public safety / emergency communications funding.`,
            `Awarding agency: ${hit.agencyName ?? hit.agencyCode ?? "federal"}. Status: ${hit.oppStatus ?? "posted"}; close date ${hit.closeDate ?? "see listing"}.`,
            `Rapid Cortex Core aligns with NG911 and dispatch modernization projects that use these grant dollars.`,
            `Engage ${classified.agencyName} before the application close window.`,
          ].join(" ");
        }

        const result = await upsertSignalAndOpportunity(
          classified,
          detailUrl,
          "Grants.gov",
          "grants_gov",
          "state_agency#US#grants",
        );
        if (result.saved) total++;
      }
    }

    console.log(JSON.stringify({ msg: "grants_gov_collector_complete", signalsFound: total }));
    return { signalsFound: total };
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "grants_gov_collector_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { signalsFound: total };
  }
}
