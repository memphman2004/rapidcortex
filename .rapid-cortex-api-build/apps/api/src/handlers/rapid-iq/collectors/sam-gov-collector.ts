import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { rapidIqIngestSinceSlashDate } from "../../../lib/rapid-iq/ingest-window.js";
import { UNIVERSITY_SEARCH_TERMS } from "../../../lib/rapid-iq/university-search-terms.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const SAM_KEYWORDS = [
  "911 CAD",
  "NG911",
  "ESInet",
  "next generation 911",
  UNIVERSITY_SEARCH_TERMS[0],
  "campus safety software",
];

export async function runSamGovCollector(): Promise<{ signalsFound: number }> {
  if (isCollectorsMockEnabled()) {
    let total = 0;
    const mocks = [
      {
        text: "SAM.gov notice: County seeks CAD / NG911 software RFP for public safety communications center modernization. Estimated $850,000.",
        url: "https://sam.gov/opp/mock-rapid-iq",
        jurisdictionId: "state_agency#US#sam",
      },
      {
        text: "SAM.gov notice: University campus safety software RFP for Clery Act compliance technology and campus emergency notification. Estimated $420,000.",
        url: "https://sam.gov/opp/mock-rapid-iq-campus",
        jurisdictionId: "university_news#US#sam",
      },
    ];
    for (const mock of mocks) {
      const classified = await classifySignal(mock.text, mock.url, "SAM.gov");
      if (!classified.isRelevant || !classified.agencyName?.trim()) continue;
      classified.state = classified.state ?? "GA";
      const result = await upsertSignalAndOpportunity(
        classified,
        mock.url,
        "SAM.gov",
        "sam_gov",
        mock.jurisdictionId,
      );
      if (result.saved) total++;
    }
    return { signalsFound: total };
  }

  const apiKey = await resolvePlainOrSecretArn(
    process.env.RAPID_IQ_SAM_GOV_API_KEY,
    process.env.RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "sam_gov_collector_skipped", reason: "no_api_key" }));
    return { signalsFound: 0 };
  }

  let total = 0;
  try {
    for (const keyword of SAM_KEYWORDS) {
      const url = `https://api.sam.gov/opportunities/v2/search?limit=5&postedFrom=${encodeURIComponent(rapidIqIngestSinceSlashDate())}&keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(url, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        opportunitiesData?: Array<{ title?: string; uiLink?: string; description?: string }>;
      };
      for (const opp of data.opportunitiesData ?? []) {
        const text = `${opp.title ?? ""}\n${opp.description ?? ""}`;
        const classified = await classifySignal(text, opp.uiLink ?? "https://sam.gov", "SAM.gov");
        if (!classified.isRelevant || !classified.agencyName?.trim()) continue;
        const result = await upsertSignalAndOpportunity(
          classified,
          opp.uiLink ?? "https://sam.gov",
          "SAM.gov",
          "sam_gov",
          "state_agency#US#sam",
        );
        if (result.saved) total++;
      }
    }
    return { signalsFound: total };
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "sam_gov_collector_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { signalsFound: total };
  }
}
