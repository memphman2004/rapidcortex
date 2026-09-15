import { describe, expect, it, vi, afterEach } from "vitest";
import { ScenarioError } from "rapid-cortex-shared";
import {
  assertDemoMode,
  isScenarioApiEnabled,
  shouldBlockDemoExternalDispatch,
  throwIfDemoIncidentReachesE911,
} from "./demo-incident-guards.js";

describe("demo incident guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fail-closes Scenario API unless ENABLE_SCENARIO_API is exactly true", () => {
    vi.stubEnv("ENABLE_SCENARIO_API", "");
    expect(isScenarioApiEnabled()).toBe(false);
    vi.stubEnv("ENABLE_SCENARIO_API", "1");
    expect(isScenarioApiEnabled()).toBe(false);
    vi.stubEnv("ENABLE_SCENARIO_API", "true");
    expect(isScenarioApiEnabled()).toBe(true);
  });

  it("blocks production agency ids even when the flag is on", () => {
    vi.stubEnv("ENABLE_SCENARIO_API", "true");
    expect(() => assertDemoMode("kcpd")).toThrow(ScenarioError);
    expect(() => assertDemoMode("test-agency")).not.toThrow();
  });

  it("treats isDemoIncident or dispatchBlocked as an external-dispatch block", () => {
    expect(shouldBlockDemoExternalDispatch({ isDemoIncident: true })).toBe(true);
    expect(shouldBlockDemoExternalDispatch({ dispatchBlocked: true })).toBe(true);
    expect(shouldBlockDemoExternalDispatch({ isDemoIncident: false })).toBe(false);
  });

  it("throws hard if a demo record reaches the E911 helper", () => {
    expect(() =>
      throwIfDemoIncidentReachesE911({ incidentId: "inc_1", isDemoIncident: true }),
    ).toThrow(/CRITICAL SAFETY VIOLATION/);
  });
});
