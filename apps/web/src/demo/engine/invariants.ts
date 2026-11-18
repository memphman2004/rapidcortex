import type { DemoAgencyState, DemoUnitStatus } from "../types";

const FIELD_STATUSES: readonly DemoUnitStatus[] = [
  "dispatched",
  "en_route",
  "on_scene",
  "transporting",
];

/** Returns human-readable problems. An empty list means the board is consistent. */
export function findStateViolations(state: DemoAgencyState): string[] {
  const violations: string[] = [];
  const activeIds = new Set(state.activeIncidents.map((incident) => incident.id));

  for (const unit of state.units) {
    const assigned = Boolean(unit.incidentId);
    if (unit.status === "available" || unit.status === "cleared") {
      if (assigned) violations.push(`${unit.id} is available but still assigned to ${unit.incidentId}`);
      continue;
    }
    if (!FIELD_STATUSES.includes(unit.status)) {
      violations.push(`${unit.id} has unknown status ${unit.status}`);
      continue;
    }
    if (!unit.incidentId || !activeIds.has(unit.incidentId)) {
      violations.push(`${unit.id} is ${unit.status} without an active incident`);
    }
  }

  for (const incident of state.activeIncidents) {
    for (const unitId of incident.units) {
      const unit = state.units.find((item) => item.id === unitId);
      if (!unit) {
        violations.push(`${incident.id} lists unknown unit ${unitId}`);
        continue;
      }
      if (unit.incidentId !== incident.id) {
        violations.push(`${unitId} is listed on ${incident.id} but assigned to ${unit.incidentId ?? "nobody"}`);
      }
    }
  }

  return violations;
}
