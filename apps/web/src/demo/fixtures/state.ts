import { MAPLEWOOD_AGENCY } from "./agency";
import { rosterOnShift } from "./dispatchers";
import { MAPLEWOOD_LOCATIONS } from "./locations";
import { availableUnits } from "./units";
import type { DemoAgencyState, DemoCall, DemoIncident } from "../types";

export interface StartingStateInput {
  onShiftIds: readonly string[];
  remoteIds?: readonly string[];
  clockLabel: string;
  callQueue?: DemoCall[];
  activeIncidents?: DemoIncident[];
  closedIncidents?: DemoIncident[];
  recentActivity?: string[];
  callsLast30Minutes?: number;
  units?: DemoAgencyState["units"];
}

export function fictionalPhone(suffix: string): string {
  return `555-014-${suffix}`;
}

export function createStartingState(input: StartingStateInput): DemoAgencyState {
  const queue = input.callQueue ?? [];
  return {
    agency: { ...MAPLEWOOD_AGENCY },
    dispatchers: rosterOnShift(input.onShiftIds, { remoteIds: input.remoteIds }),
    units: input.units ?? availableUnits(),
    locations: MAPLEWOOD_LOCATIONS.map((location) => ({ ...location })),
    activeIncidents: input.activeIncidents ?? [],
    closedIncidents: input.closedIncidents ?? [],
    callQueue: queue,
    alerts: [],
    mutualAid: [],
    coverageGap: false,
    recentActivity: input.recentActivity ?? [],
    metrics: {
      callsAnswered: 0,
      queueDepth: queue.filter((call) => call.status === "queued").length,
      adminRouted: 0,
      callsLast30Minutes: input.callsLast30Minutes ?? 0,
    },
    clockLabel: input.clockLabel,
  };
}
