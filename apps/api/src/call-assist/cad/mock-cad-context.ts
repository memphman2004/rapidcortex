import type { CadIncidentLocation, CadNearbyIncident, CallAssistPremiseHazard } from "rapid-cortex-shared";

/** Nearby incidents and premise hazards come from the live vendor only. */
export function mockNearbyIncidents(_location: CadIncidentLocation): CadNearbyIncident[] {
  return [];
}

export function mockPremiseHazards(_location: CadIncidentLocation): CallAssistPremiseHazard[] {
  return [];
}
