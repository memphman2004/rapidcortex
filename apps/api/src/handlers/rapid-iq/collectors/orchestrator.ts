import type { Handler } from "aws-lambda";
import { selectJurisdictionsForRun } from "../../../lib/rapid-iq/jurisdiction-scheduler.js";
import { applyStateCoverageBoosts } from "../../../lib/rapid-iq/state-coverage-tracker.js";
import { RapidIqJurisdictionRepository } from "../../../repositories/rapidIqJurisdictionRepository.js";
import { RapidIqRefreshStatusRepository } from "../../../repositories/rapidIqRefreshStatusRepository.js";
import { runAgendaCollector } from "./agenda-collector.js";
import { runE911CoordinatorCollector } from "./e911-coordinator-collector.js";
import { runFemaGrantsCollector } from "./fema-grants-collector.js";
import { runGrantsGovCollector } from "./grants-gov-collector.js";
import { runLegislatureCollector } from "./legislature-collector.js";
import { runSamGovCollector } from "./sam-gov-collector.js";
import { runUniversityNewsCollector } from "./university-news-collector.js";
import { runConferenceCollector } from "./conference-collector.js";

const repo = new RapidIqJurisdictionRepository();
const refreshRepo = new RapidIqRefreshStatusRepository();

export function isWithinCollectionWindow(now = new Date()): boolean {
  const etHour = Number.parseInt(
    now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }),
    10,
  );
  return etHour >= 0 && etHour < 19;
}

export type OrchestratorEvent = {
  source?: string;
};

export async function runOrchestrator(event: OrchestratorEvent = {}): Promise<{
  skipped?: boolean;
  signalsFound?: number;
}> {
  const isManual = event.source === "manual-refresh";

  if (!isManual && !isWithinCollectionWindow()) {
    console.log(
      JSON.stringify({
        msg: "rapid_iq_collector_skipped",
        reason: "outside_collection_window",
        utcTime: new Date().toISOString(),
      }),
    );
    return { skipped: true };
  }

  await refreshRepo.put({
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    signalsFound: 0,
    error: null,
  });

  let totalSignals = 0;

  try {
    let jurisdictions = await repo.listAll();
    jurisdictions = await applyStateCoverageBoosts(jurisdictions, repo);
    const batch = selectJurisdictionsForRun(jurisdictions);

    console.log(
      JSON.stringify({
        msg: "rapid_iq_run_started",
        isManual,
        source: isManual ? "manual-refresh" : (event.source ?? "scheduler"),
        batchSize: batch.length,
        statesInBatch: [...new Set(batch.map((j) => j.stateCode))].sort(),
        tierBreakdown: {
          tier0: batch.filter((j) => j.tier === 0).length,
          tier1: batch.filter((j) => j.tier === 1).length,
          tier2: batch.filter((j) => j.tier === 2).length,
          tier3: batch.filter((j) => j.tier === 3).length,
        },
        collectors: [
          "agenda",
          "sam_gov",
          "grants_gov",
          "legislature",
          "e911_coordinator",
          "fema_grants",
          "university_news",
          "conference",
        ],
      }),
    );

    const [
      agendaResult,
      samResult,
      grantsResult,
      legislatureResult,
      e911Result,
      femaResult,
      uniNewsResult,
      conferenceResult,
    ] = await Promise.allSettled([
      runAgendaCollector(batch),
      runSamGovCollector(),
      runGrantsGovCollector(),
      runLegislatureCollector(),
      runE911CoordinatorCollector(),
      runFemaGrantsCollector(),
      runUniversityNewsCollector(),
      runConferenceCollector(),
    ]);

    for (const result of [
      agendaResult,
      samResult,
      grantsResult,
      legislatureResult,
      e911Result,
      femaResult,
      uniNewsResult,
      conferenceResult,
    ]) {
      if (result.status === "fulfilled") {
        totalSignals += result.value.signalsFound;
      } else {
        console.error(
          JSON.stringify({
            msg: "rapid_iq_collector_rejected",
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        msg: "rapid_iq_collector_settlement",
        agenda: agendaResult.status,
        sam_gov: samResult.status,
        grants_gov: grantsResult.status,
        legislature: legislatureResult.status,
        e911_coordinator: e911Result.status,
        fema_grants: femaResult.status,
        university_news: uniNewsResult.status,
        conference: conferenceResult.status,
        signalsFound: totalSignals,
      }),
    );

    const now = new Date().toISOString();
    await Promise.allSettled(batch.map((j) => repo.updateLastScanned(j.jurisdictionId, now)));

    const statesScanned = [...new Set(batch.map((j) => j.stateCode))];
    await Promise.allSettled(statesScanned.map((s) => repo.updateStateCoverage(s, now)));

    await refreshRepo.put({
      status: "complete",
      startedAt: null,
      completedAt: now,
      signalsFound: totalSignals,
      error: null,
    });

    console.log(JSON.stringify({ msg: "rapid_iq_run_complete", signalsFound: totalSignals }));
    return { signalsFound: totalSignals };
  } catch (err) {
    await refreshRepo.put({
      status: "error",
      startedAt: null,
      completedAt: new Date().toISOString(),
      signalsFound: totalSignals,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export const handler: Handler = async (event) => {
  return runOrchestrator((event ?? {}) as OrchestratorEvent);
};
