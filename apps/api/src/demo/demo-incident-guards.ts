import { isDemoAgencyId, ScenarioError } from "rapid-cortex-shared";

/** Strict fail-closed: unset / "1" / "true"-adjacent values do not enable Scenario Center. */
export function isScenarioApiEnabled(): boolean {
  return process.env.ENABLE_SCENARIO_API === "true";
}

export function shouldBlockDemoExternalDispatch(
  incident: { isDemoIncident?: boolean; dispatchBlocked?: boolean } | null | undefined,
): boolean {
  return incident?.isDemoIncident === true || incident?.dispatchBlocked === true;
}

/**
 * No dedicated E911 adapter exists in this repo (Call Assist CAD create is the closest path).
 * Call this if any 911-adjacent dispatch is reached with a demo record — always a bug.
 */
export function throwIfDemoIncidentReachesE911(incident: {
  incidentId?: string;
  isDemoIncident?: boolean;
  dispatchBlocked?: boolean;
} | null | undefined): void {
  if (!shouldBlockDemoExternalDispatch(incident)) return;
  throw new Error(
    `CRITICAL SAFETY VIOLATION: 911 adapter received demo incident ${incident?.incidentId ?? "unknown"}. ` +
      `isDemoIncident must be checked before reaching this adapter.`,
  );
}

export function assertDemoMode(agencyId: string): void {
  if (!isScenarioApiEnabled()) {
    throw new ScenarioError("SCENARIO_API_DISABLED", "ENABLE_SCENARIO_API is not 'true'");
  }
  if (!isDemoAgencyId(agencyId)) {
    throw new ScenarioError(
      "NOT_DEMO_AGENCY",
      `'${agencyId}' is not in the demo allowlist. Scenario API is disabled for production agencies.`,
    );
  }
}
