import type { Handler } from "aws-lambda";
import {
  applyVenueSeasonalBoost,
  selectJurisdictionsForRun,
} from "../../../lib/rapid-iq/jurisdiction-scheduler.js";
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
import { runCompetitorCollector } from "./competitor-collector.js";
import { runVenueCollector } from "./venue-collector.js";
import { runRampCollector } from "./ramp-collector.js";

const repo = new RapidIqJurisdictionRepository();
const refreshRepo = new RapidIqRefreshStatusRepository();

const RAMP_INTERVAL_HOURS = 48;

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

function isRampOnlySource(source: string | undefined): boolean {
  return source === "ramp-scheduler" || source === "ramp-manual";
}

async function hoursSinceLastRampScan(): Promise<number> {
  const last = await refreshRepo.getRampScan();
  if (!last.completedAt) return 999;
  return (Date.now() - new Date(last.completedAt).getTime()) / 3_600_000;
}

async function runRampIfDue(force: boolean): Promise<{ signalsFound: number }> {
  if (!force) {
    const hours = await hoursSinceLastRampScan();
    if (hours < RAMP_INTERVAL_HOURS) {
      console.log(
        JSON.stringify({
          msg: "ramp_collector_skipped",
          reason: "within_48h_window",
          hoursSinceLastScan: Math.round(hours * 10) / 10,
        }),
      );
      return { signalsFound: 0 };
    }
  }
  const result = await runRampCollector();
  await refreshRepo.putRampScan(result.signalsFound);
  return result;
}

export async function runOrchestrator(event: OrchestratorEvent = {}): Promise<{
  skipped?: boolean;
  signalsFound?: number;
}> {
  const source = event.source ?? "scheduler";
  const isManual = source === "manual-refresh";
  const isRampOnly = isRampOnlySource(source);
  const forceRamp = source === "ramp-manual";

  // RAMP-only runs always execute (manual or 48h EventBridge). Full scans respect ET window.
  if (!isManual && !isRampOnly && !isWithinCollectionWindow()) {
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
    if (isRampOnly) {
      console.log(
        JSON.stringify({
          msg: "rapid_iq_ramp_run_started",
          source,
          force: forceRamp,
        }),
      );
      totalSignals = (await runRampIfDue(forceRamp)).signalsFound;
      const now = new Date().toISOString();
      await refreshRepo.put({
        status: "complete",
        startedAt: null,
        completedAt: now,
        signalsFound: totalSignals,
        error: null,
      });
      console.log(
        JSON.stringify({ msg: "rapid_iq_ramp_run_complete", signalsFound: totalSignals }),
      );
      return { signalsFound: totalSignals };
    }

    let jurisdictions = await repo.listAll();
    jurisdictions = await applyStateCoverageBoosts(jurisdictions, repo);
    jurisdictions = applyVenueSeasonalBoost(jurisdictions);
    const batch = selectJurisdictionsForRun(jurisdictions);

    console.log(
      JSON.stringify({
        msg: "rapid_iq_run_started",
        isManual,
        source: isManual ? "manual-refresh" : source,
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
          "venue",
          "competitor",
          "ramp",
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
      venueResult,
      competitorResult,
      rampResult,
    ] = await Promise.allSettled([
      runAgendaCollector(batch),
      runSamGovCollector(),
      runGrantsGovCollector(),
      runLegislatureCollector(),
      runE911CoordinatorCollector(),
      runFemaGrantsCollector(),
      runUniversityNewsCollector(),
      runConferenceCollector(),
      runVenueCollector(),
      runCompetitorCollector(),
      runRampIfDue(false),
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
      venueResult,
      competitorResult,
      rampResult,
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
        venue: venueResult.status,
        competitor: competitorResult.status,
        ramp: rampResult.status,
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
