import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

export async function runSamGovCollector(): Promise<{ signalsFound: number }> {
  if (isCollectorsMockEnabled()) {
    const classified = await classifySignal(
      "SAM.gov notice: County seeks CAD / NG911 software RFP for public safety communications center modernization. Estimated $850,000.",
      "https://sam.gov/opp/mock-rapid-iq",
      "SAM.gov",
    );
    if (classified.isRelevant) {
      classified.state = classified.state ?? "GA";
      await upsertSignalAndOpportunity(
        classified,
        "https://sam.gov/opp/mock-rapid-iq",
        classified.agencyName ?? "SAM.gov Opportunity",
        "sam_gov",
        "state_agency#US#sam",
      );
      return { signalsFound: 1 };
    }
    return { signalsFound: 0 };
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

  // Live SAM.gov search is intentionally narrow; failures must not fail the run.
  try {
    const url =
      "https://api.sam.gov/opportunities/v2/search?limit=5&postedFrom=01/01/2024&keyword=911%20CAD";
    const res = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { signalsFound: 0 };
    const data = (await res.json()) as {
      opportunitiesData?: Array<{ title?: string; uiLink?: string; description?: string }>;
    };
    let total = 0;
    for (const opp of data.opportunitiesData ?? []) {
      const text = `${opp.title ?? ""}\n${opp.description ?? ""}`;
      const classified = await classifySignal(text, opp.uiLink ?? "https://sam.gov", "SAM.gov");
      if (!classified.isRelevant) continue;
      await upsertSignalAndOpportunity(
        classified,
        opp.uiLink ?? "https://sam.gov",
        classified.agencyName ?? opp.title ?? "SAM.gov",
        "sam_gov",
        "state_agency#US#sam",
      );
      total++;
    }
    return { signalsFound: total };
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "sam_gov_collector_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { signalsFound: 0 };
  }
}
