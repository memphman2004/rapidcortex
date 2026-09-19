import type { APCOUnitStatusCode, ISO8601 } from "../eido/types.js";

export interface UnitLocation {
  unitId: string;
  agencyId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speedMph: number;
  timestamp: ISO8601;
  status: APCOUnitStatusCode;
  unitType: string;
  incidentId?: string;
}

export interface UnitDefinition {
  unitId: string;
  unitType: string;
  agencyId: string;
}

export interface UnitRoster {
  agencyId: string;
  units: UnitDefinition[];
  asOf: ISO8601;
}
