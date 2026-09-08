import type { CadIncidentLocation, CadNearbyIncident, CallAssistPremiseHazard } from "rapid-cortex-shared";

function needle(location: CadIncidentLocation): string {
  return (location.text ?? "").trim().toLowerCase();
}

/** Demo CAD nearby/hazards. Live vendors stay empty until CAD UAT + flags. */
export function mockNearbyIncidents(location: CadIncidentLocation): CadNearbyIncident[] {
  const text = needle(location);
  if (!text) return [];
  const key = text.replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return [
    {
      cadIncidentId: `mock-near-${key || "loc"}`,
      locationText: location.text,
      nature: "PRIOR",
      status: "open",
      openedAt: new Date().toISOString(),
    },
  ];
}

export function mockPremiseHazards(location: CadIncidentLocation): CallAssistPremiseHazard[] {
  const text = needle(location);
  if (!text) return [];
  if (/\b(hazard|gun|weapon|officer|dogs?|caution|4200 oak)\b/i.test(text)) {
    return [{ code: "PREM-SAFE", summary: "Premise hazard on file (mock CAD)", officerSafety: true }];
  }
  return [];
}
