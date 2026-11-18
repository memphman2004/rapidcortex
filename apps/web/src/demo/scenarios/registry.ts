import type { DemoScenarioManifest } from "../types";
import { buildAllScenarios } from "./manifests";

const disabled = new Set<string>();
const timingOverrides = new Map<string, number>();

function applyTiming(scenario: DemoScenarioManifest): DemoScenarioManifest {
  if (timingOverrides.size === 0) return scenario;
  return {
    ...scenario,
    events: scenario.events.map((item) => {
      const override = timingOverrides.get(`${scenario.id}:${item.id}`);
      return override === undefined ? item : { ...item, relativeOffsetSeconds: override };
    }),
  };
}

export function listScenarios(): DemoScenarioManifest[] {
  return buildAllScenarios()
    .map(applyTiming)
    .filter((scenario) => scenario.enabled && !disabled.has(scenario.id));
}

export function listScenariosIncludingDisabled(): DemoScenarioManifest[] {
  return buildAllScenarios().map((scenario) => ({
    ...applyTiming(scenario),
    enabled: scenario.enabled && !disabled.has(scenario.id),
  }));
}

export function getScenario(scenarioId: string): DemoScenarioManifest | null {
  return listScenariosIncludingDisabled().find((scenario) => scenario.id === scenarioId) ?? null;
}

export function setScenarioEnabled(scenarioId: string, enabled: boolean): void {
  if (enabled) disabled.delete(scenarioId);
  else disabled.add(scenarioId);
}

export function setEventOffset(scenarioId: string, eventId: string, offsetSeconds: number): void {
  timingOverrides.set(`${scenarioId}:${eventId}`, offsetSeconds);
}

export function resetScenarioRegistry(): void {
  disabled.clear();
  timingOverrides.clear();
}
