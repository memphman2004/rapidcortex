import type {
  AgencyIntelligenceProfile,
  CallVolumeIntelligence,
  ModernizationIntelligence,
  StaffingIntelligence,
  TechnologyIntelligence,
  VerifiedHeadcount,
  VerifiedValue,
} from "./types.js";
import { AGENCY_INTELLIGENCE_SCHEMA_VERSION } from "./types.js";

export function unknownValue<T>(): VerifiedValue<T> {
  return {
    value: null,
    verificationStatus: "UNKNOWN",
    reportingPeriod: null,
    reportDate: null,
    evidenceId: null,
    sourceType: null,
  };
}

export function unknownHeadcount(): VerifiedHeadcount {
  return { ...unknownValue<number>(), countingMethod: null };
}

export function emptyStaffing(): StaffingIntelligence {
  return {
    reportedDispatcherHeadcount: unknownHeadcount(),
    authorizedDispatcherPositions: unknownValue(),
    filledDispatcherPositions: unknownValue(),
    fullTimeDispatcherCount: unknownValue(),
    partTimeDispatcherCount: unknownValue(),
    reserveOrPerDiemDispatcherCount: unknownValue(),
    dispatchCapableSupervisors: unknownValue(),
    dispatcherVacancies: unknownValue(),
    dispatcherFte: unknownValue(),
  };
}

export function emptyCallVolume(): CallVolumeIntelligence {
  return {
    annual911Calls: unknownValue(),
    annualAdministrativeCalls: unknownValue(),
    annualNonEmergencyCalls: unknownValue(),
  };
}

export function emptyTechnology(): TechnologyIntelligence {
  return { cadProvider: unknownValue(), namedBidders: [] };
}

export function emptyModernization(): ModernizationIntelligence {
  return {
    status: unknownValue(),
    activeRfp: unknownValue(),
    rfpDeadline: null,
  };
}

export function emptyAgencyIntelligenceProfile(
  actor: string,
  nowIso: string,
): AgencyIntelligenceProfile {
  return {
    schemaVersion: AGENCY_INTELLIGENCE_SCHEMA_VERSION,
    psapClassification: unknownValue(),
    primaryReceivingPoint: unknownValue(),
    fccPsapId: unknownValue(),
    alternativeNames: [],
    parentOrganization: null,
    operationalStatus: "UNKNOWN",
    governmentWebsite: null,
    dispatchWebsite: null,
    publishedEmail: null,
    populationServed: null,
    staffing: emptyStaffing(),
    callVolume: emptyCallVolume(),
    technology: emptyTechnology(),
    modernization: emptyModernization(),
    evidence: [],
    decisions: [],
    valueHistory: [],
    updatedAt: nowIso,
    updatedBy: actor,
  };
}
