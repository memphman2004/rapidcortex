import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

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

  // Live Grants.gov API optional — skip quietly when not configured.
  console.log(JSON.stringify({ msg: "grants_gov_collector_skipped", reason: "live_path_not_configured" }));
  return { signalsFound: 0 };
}
