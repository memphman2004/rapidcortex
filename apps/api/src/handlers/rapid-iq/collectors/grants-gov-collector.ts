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
    if (classified.isRelevant) {
      classified.state = classified.state ?? "AL";
      await upsertSignalAndOpportunity(
        classified,
        "https://www.grants.gov/search-results-detail/mock-rapid-iq",
        classified.agencyName ?? "Federal NG911 Grant",
        "grants_gov",
        "state_agency#US#grants",
      );
      return { signalsFound: 1 };
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
        if (!classified.isRelevant) {
          // Grants.gov keyword hits are already filtered — force relevance for matching RFAs
          classified.isRelevant = true;
          classified.signalType = "grant";
          classified.aiHeadline =
            classified.aiHeadline ?? hit.title ?? "Federal public safety grant opportunity";
          classified.aiSummary =
            classified.aiSummary ??
            [
              `Grants.gov lists "${hit.title ?? "a funding opportunity"}" from ${hit.agencyName ?? "a federal agency"} relevant to 911 / emergency communications modernization.`,
              `Eligible applicants include state and local public safety agencies that may use award dollars for NG911, dispatch, or communications technology.`,
              `Rapid Cortex Core and related products align with grant-funded PSAP modernization and AI-assisted operations.`,
              `Track the close date (${hit.closeDate ?? "see Grants.gov"}) and engage agencies preparing applications now.`,
            ].join(" ");
          classified.tags = Array.from(
            new Set(["GRANT FUNDING", "NG911", "OPPORTUNITY", ...(classified.tags ?? [])]),
          );
          classified.scoreContrib = Math.max(classified.scoreContrib ?? 0, 22);
        }
        classified.signalType = classified.signalType ?? "grant";
        classified.state = classified.state ?? "US";
        classified.sourceDocUrl = detailUrl;

        await upsertSignalAndOpportunity(
          classified,
          detailUrl,
          classified.agencyName ?? hit.agencyName ?? hit.title ?? "Grants.gov Opportunity",
          "grants_gov",
          "state_agency#US#grants",
        );
        total++;
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
