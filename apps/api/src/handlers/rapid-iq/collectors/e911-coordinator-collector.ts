import {
  extractPdfText,
  findAgendaDocuments,
} from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import type { Jurisdiction } from "../../../lib/rapid-iq/jurisdiction-registry.js";
import { SOURCE_SCORE_BOOSTS } from "../../../lib/rapid-iq/opportunity-scorer.js";
import {
  selectE911OfficesForRun,
  type StateE911Coordinator,
} from "../../../lib/rapid-iq/state-e911-coordinators.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function officeAsJurisdiction(office: StateE911Coordinator): Jurisdiction {
  return {
    jurisdictionId: `e911#${office.stateCode}`,
    type: "state_agency",
    name: office.name,
    stateCode: office.stateCode,
    stateName: office.stateCode,
    population: 0,
    tier: 2,
    tierWeight: 1,
    intervalHours: 168,
    agendaBaseUrl: office.url.replace(/\/$/, ""),
    agendaPathHints: office.pathHints,
    lastScannedAt: "",
    lastSignalAt: null,
    totalSignalsFound: 0,
    isActive: true,
    priorityBoost: 0,
    notes: null,
  };
}

export async function runE911CoordinatorCollector(): Promise<{ signalsFound: number }> {
  let total = 0;
  const cutoff = ninetyDaysAgo();
  const offices = selectE911OfficesForRun();

  console.log(
    JSON.stringify({
      msg: "e911_coordinator_collector_started",
      officesThisRun: offices.map((o) => o.stateCode),
    }),
  );

  for (const office of offices) {
    try {
      await sleep(3_000);

      const docs = await findAgendaDocuments(officeAsJurisdiction(office));
      const recent = docs
        .filter((d) => !d.publishedAt || d.publishedAt.slice(0, 10) >= cutoff)
        .slice(0, 3);

      for (const doc of recent) {
        const pdfText = await extractPdfText(doc.url);
        if (!pdfText) continue;

        const signal = await classifySignal(pdfText, doc.url, office.name);
        if (!signal.isRelevant) continue;

        signal.signalType = signal.signalType ?? "budget";
        signal.state = signal.state ?? office.stateCode;
        signal.tags = Array.from(new Set(["E911 PLAN", ...(signal.tags ?? [])]));
        signal.scoreContrib =
          (signal.scoreContrib ?? 0) + SOURCE_SCORE_BOOSTS.e911CoordinatorReport;

        await upsertSignalAndOpportunity(
          signal,
          doc.url,
          office.name,
          "government_doc",
          `e911_coordinator#${office.stateCode}`,
        );
        total++;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "e911_coordinator_collector_error",
          office: office.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(
    JSON.stringify({ msg: "e911_coordinator_collector_complete", signalsFound: total }),
  );
  return { signalsFound: total };
}
