/**
 * Runs all canned scenarios for a vertical in sequence.
 * Data-layer validation lives here; UI checks stay on the browser agent prompt.
 * Each scenario resets demo incidents before the next run.
 */

import type { QaSuiteResult, ScenarioVertical } from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { assertDemoMode } from "./demo-incident-guards.js";
import { resetDemoIncidents, ScenarioRunner } from "./scenario-runner.js";
import { SCENARIOS } from "./scenarios/index.js";

const incidentRepo = new IncidentRepository();

export async function runQaSuite(
  agencyId: string,
  vertical: ScenarioVertical,
  actor: UserContext,
): Promise<QaSuiteResult> {
  assertDemoMode(agencyId);
  const startTime = Date.now();
  const scenariosForVertical = SCENARIOS.filter((s) => s.vertical === vertical);
  const results: QaSuiteResult["scenarios"] = [];

  await resetDemoIncidents(agencyId);

  for (const scenario of scenariosForVertical) {
    const scenarioStart = Date.now();
    const runner = new ScenarioRunner(agencyId, scenario.id, actor);
    try {
      const result = await scenario.execute(agencyId, runner);
      const failedChecks: string[] = [];
      const incident = await incidentRepo.get(result.incidentId);
      if (!incident || incident.agencyId !== agencyId) failedChecks.push("incident_not_found_post_seed");
      if (incident && incident.isDemoIncident !== true) failedChecks.push("missing_isDemoIncident_flag");
      if (incident && (incident.ttl == null || incident.ttl <= 0)) failedChecks.push("missing_ttl");
      if (incident && incident.dispatchBlocked !== true) failedChecks.push("missing_dispatchBlocked");

      results.push({
        scenarioId: scenario.id,
        label: scenario.label,
        passed: failedChecks.length === 0,
        failedChecks,
        durationMs: Date.now() - scenarioStart,
        incidentId: result.incidentId,
      });
    } catch (err: unknown) {
      results.push({
        scenarioId: scenario.id,
        label: scenario.label,
        passed: false,
        failedChecks: [`execution_error: ${err instanceof Error ? err.message : String(err)}`],
        durationMs: Date.now() - scenarioStart,
        incidentId: "none",
      });
    }

    try {
      await resetDemoIncidents(agencyId);
    } catch (err: unknown) {
      console.warn(
        JSON.stringify({
          type: "scenario.qa_reset_failed",
          agencyId,
          scenarioId: scenario.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return {
    vertical,
    totalScenarios: scenariosForVertical.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    scenarios: results,
    runAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}
