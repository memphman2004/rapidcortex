import type { CallIntakeData } from "./intake.js";

/** CAD vendor ids — adapters register here; engines never switch on these. */
export const CAD_PROVIDER_IDS = [
  "mock",
  "motorola-premierone",
  "tyler-new-world",
  "mark43",
  "hexagon-intergraph",
  "versaterm",
  "centralsquare",
  "zetron",
] as const;
export type CadProviderId = (typeof CAD_PROVIDER_IDS)[number];

export const CAD_CAPABILITIES = [
  "CREATE_INCIDENT",
  "UPDATE_INCIDENT",
  "NEARBY_INCIDENTS",
  "PREMISE_HAZARDS",
  "UNIT_STATUS",
  "CALL_HISTORY",
  "CAD_NOTES",
  "DUPLICATE_DETECTION",
  "INCIDENT_ATTACHMENTS",
] as const;
export type CadCapability = (typeof CAD_CAPABILITIES)[number];

export type CadProviderInfo = {
  id: CadProviderId;
  name: string;
  version: string;
  capabilities: CadCapability[];
};

export type CadIncidentLocation = {
  text?: string;
  lat?: number;
  lng?: number;
};

export type CadCreateOptions = {
  humanReviewApproved: boolean;
  actorId: string;
  demo?: boolean;
};

export type CadIncidentResult = {
  ok: boolean;
  blocked: boolean;
  pendingReview: boolean;
  cadIncidentId?: string;
  reason: string;
  vendor?: CadProviderId;
};

export type CadNearbyIncident = {
  cadIncidentId: string;
  locationText?: string;
  nature?: string;
  status?: string;
  openedAt?: string;
};

export type CallAssistPremiseHazard = {
  code: string;
  summary: string;
  officerSafety: boolean;
};

export type CadUnitStatus = {
  unitId: string;
  status: string;
  locationText?: string;
};

export type CadCallHistoryEntry = {
  cadIncidentId: string;
  openedAt: string;
  nature?: string;
};

/** Mapping of RC triage / intake hints → vendor nature codes lives on the adapter config only. */
export type CadNatureMapping = Record<string, string>;

export type CallAssistCadCreatePayload = {
  agencyId: string;
  intake: CallIntakeData;
  classification: string;
  location: CadIncidentLocation;
};
