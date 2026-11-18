/**
 * Agency Intelligence — field-level facts on an existing PSAP prospect.
 * Phase 1 stores this on the prospect item. It is not a second agency database.
 */

export const AGENCY_INTELLIGENCE_SCHEMA_VERSION = 1 as const;

export const PSAP_CLASSIFICATIONS = [
  "PRIMARY",
  "SECONDARY",
  "CONSOLIDATED_REGIONAL",
  "UNKNOWN",
  "CLOSED_MERGED_INACTIVE",
] as const;
export type PsapClassification = (typeof PSAP_CLASSIFICATIONS)[number];

export const VERIFICATION_STATUSES = [
  "AGENCY_CONFIRMED",
  "OFFICIAL_SOURCE_VERIFIED",
  "THIRD_PARTY_SOURCED",
  "PENDING_REVIEW",
  "CONFLICTING",
  "STALE",
  "UNKNOWN",
] as const;
export type AgencyIntelligenceVerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Statuses that may enter the default verified seven-or-fewer list. */
export const QUALIFYING_VERIFICATION_STATUSES = [
  "AGENCY_CONFIRMED",
  "OFFICIAL_SOURCE_VERIFIED",
] as const;
export type QualifyingVerificationStatus = (typeof QUALIFYING_VERIFICATION_STATUSES)[number];

/**
 * Counting methods are stored separately so a console count is never treated
 * as employee headcount. The default prospecting filter uses only
 * DISTINCT_DISPATCH_PERSONNEL.
 */
export const STAFFING_COUNT_METHODS = [
  "DISTINCT_DISPATCH_PERSONNEL",
  "AUTHORIZED_POSITIONS",
  "FILLED_POSITIONS",
  "FULL_TIME_ONLY",
  "FTE",
  "CONSOLE_POSITIONS",
  "ON_DUTY_SHIFT",
] as const;
export type StaffingCountMethod = (typeof STAFFING_COUNT_METHODS)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "AGENCY_CONFIRMATION",
  "OFFICIAL_BUDGET",
  "OFFICIAL_REPORT",
  "STATE_DIRECTORY",
  "JOB_POSTING",
  "PROCUREMENT_RECORD",
  "FCC_REGISTRY",
  "MANUAL_RESEARCH",
  "THIRD_PARTY",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_CONFIDENCE = ["HIGH", "MEDIUM", "LOW"] as const;
export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE)[number];

export const INTELLIGENCE_FIELDS = [
  "psapClassification",
  "primaryReceivingPoint",
  "fccPsapId",
  "reportedDispatcherHeadcount",
  "authorizedDispatcherPositions",
  "filledDispatcherPositions",
  "fullTimeDispatcherCount",
  "partTimeDispatcherCount",
  "reserveOrPerDiemDispatcherCount",
  "dispatchCapableSupervisors",
  "dispatcherVacancies",
  "dispatcherFte",
  "annual911Calls",
  "annualAdministrativeCalls",
  "annualNonEmergencyCalls",
  "cadProvider",
  "modernizationStatus",
  "activeRfp",
  "rfpDeadline",
] as const;
export type IntelligenceField = (typeof INTELLIGENCE_FIELDS)[number];

export const CAD_PROVIDER_ROLES = ["INCUMBENT", "BIDDER", "UNKNOWN"] as const;
export type CadProviderRole = (typeof CAD_PROVIDER_ROLES)[number];

export const MODERNIZATION_STATUSES = [
  "UNKNOWN",
  "NONE_REPORTED",
  "DISCUSSED",
  "PLANNED",
  "FUNDED",
  "SOLICITED",
  "AWARDED",
  "CANCELED",
] as const;
export type ModernizationStatus = (typeof MODERNIZATION_STATUSES)[number];

export const OPERATIONAL_STATUSES = ["ACTIVE", "CLOSED", "MERGED", "UNKNOWN"] as const;
export type AgencyOperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export type VerifiedValue<T> = {
  value: T | null;
  verificationStatus: AgencyIntelligenceVerificationStatus;
  reportingPeriod: string | null;
  reportDate: string | null;
  evidenceId: string | null;
  sourceType: EvidenceSourceType | null;
};

export type VerifiedHeadcount = VerifiedValue<number> & {
  countingMethod: StaffingCountMethod | null;
};

export type StaffingIntelligence = {
  reportedDispatcherHeadcount: VerifiedHeadcount;
  authorizedDispatcherPositions: VerifiedValue<number>;
  filledDispatcherPositions: VerifiedValue<number>;
  fullTimeDispatcherCount: VerifiedValue<number>;
  partTimeDispatcherCount: VerifiedValue<number>;
  reserveOrPerDiemDispatcherCount: VerifiedValue<number>;
  dispatchCapableSupervisors: VerifiedValue<number>;
  dispatcherVacancies: VerifiedValue<number>;
  /** Vacancy percentage is computed only when authorized and filled are both verified. */
  dispatcherFte: VerifiedValue<number>;
};

export type CallVolumeIntelligence = {
  annual911Calls: VerifiedValue<number>;
  annualAdministrativeCalls: VerifiedValue<number>;
  annualNonEmergencyCalls: VerifiedValue<number>;
};

export type TechnologyIntelligence = {
  /** Current incumbent only. A bidder is never written here. */
  cadProvider: VerifiedValue<string>;
  /** Vendors named as bidders or respondents, not incumbents. */
  namedBidders: string[];
};

export type ModernizationIntelligence = {
  status: VerifiedValue<ModernizationStatus>;
  activeRfp: VerifiedValue<boolean>;
  /** ISO date. A passed deadline means the RFP is not treated as open. */
  rfpDeadline: string | null;
};

export type EvidenceClaim = {
  evidenceId: string;
  field: IntelligenceField;
  proposedValue: string | number | boolean;
  countingMethod: StaffingCountMethod | null;
  cadProviderRole: CadProviderRole | null;
  sourceType: EvidenceSourceType;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  reportingPeriod: string | null;
  quotedPassage: string | null;
  contactRole: string | null;
  confidence: EvidenceConfidence;
  verificationStatus: AgencyIntelligenceVerificationStatus;
  extractedAt: string;
  submittedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decision: "PENDING" | "APPROVED" | "REJECTED" | null;
};

export type VerificationDecisionRecord = {
  decisionId: string;
  evidenceId: string;
  action: "approve" | "reject" | "approve_over_conflict";
  decidedBy: string;
  decidedAt: string;
  note: string | null;
  previousValue: string | number | boolean | null;
};

export type ValueHistoryEntry = {
  field: IntelligenceField;
  previousValue: string | number | boolean | null;
  previousVerification: AgencyIntelligenceVerificationStatus;
  replacedAt: string;
  replacedByEvidenceId: string;
  replacedBy: string;
};

export type AgencyIntelligenceProfile = {
  schemaVersion: typeof AGENCY_INTELLIGENCE_SCHEMA_VERSION;
  psapClassification: VerifiedValue<PsapClassification>;
  /** True when a consolidated center is still a primary receiving point. */
  primaryReceivingPoint: VerifiedValue<boolean>;
  /** Stored as a string so leading zeros survive. */
  fccPsapId: VerifiedValue<string>;
  alternativeNames: string[];
  parentOrganization: string | null;
  operationalStatus: AgencyOperationalStatus;
  governmentWebsite: string | null;
  dispatchWebsite: string | null;
  publishedEmail: string | null;
  populationServed: number | null;
  staffing: StaffingIntelligence;
  callVolume: CallVolumeIntelligence;
  technology: TechnologyIntelligence;
  modernization: ModernizationIntelligence;
  evidence: EvidenceClaim[];
  decisions: VerificationDecisionRecord[];
  valueHistory: ValueHistoryEntry[];
  updatedAt: string;
  updatedBy: string;
};

export const HEADCOUNT_BASES = [
  "DISTINCT_DISPATCH_PERSONNEL",
  "AUTHORIZED_POSITIONS",
  "FTE",
] as const;
export type HeadcountBasis = (typeof HEADCOUNT_BASES)[number];

export type SavedPsapFilter = {
  id: string;
  name: string;
  psapType: "PRIMARY";
  maximumDispatcherHeadcount: number;
  headcountBasis: HeadcountBasis;
  minimumVacancies: number | null;
  modernizationStatus: "ANY";
  geography: "UNITED_STATES";
  includeUnverifiedStaffingInQualifiedResults: boolean;
  includeUnverifiedPrimaryStatus: boolean;
  sortBy: "opportunityScore" | "agencyName" | "state";
  sortDirection: "ASC" | "DESC";
};

export const CIVIC_IQ_CONNECTION = {
  status: "REQUIRES_CONFIGURATION",
  liveSync: false,
  reason:
    "Production Civic IQ access needs a server-to-server API key in AWS Secrets Manager. The development MCP connector is for research only and is not a production credential.",
} as const;

export const FCC_REGISTRY_SOURCE = {
  datasetId: "dpq5-ta9j",
  sourceUrl: "https://opendata.fcc.gov/Public-Safety/911-Master-PSAP-Registry/dpq5-ta9j",
  importStatus: "NOT_IMPLEMENTED",
  freshnessNote:
    "The FCC Open Data listing has historically shown a February 2019 update. Use it for PSAP ID assignment after a freshness check. It is not current staffing, CAD, or primary-PSAP evidence.",
} as const;

export const SEARCH_INDEX_STATUS = {
  status: "NOT_IMPLEMENTED",
  note:
    "Phase 1 filters in application code. A state selection uses the existing PSAP state index. Nationwide multi-attribute search still reads the prospect table and needs OpenSearch or a stream-fed index before production-scale filtering.",
} as const;

/** Product defaults. These are review intervals, not a claim that sources publish this often. */
export const DEFAULT_FRESHNESS_DAYS = {
  vacancies: 30,
  staffing: 180,
  callVolume: 365,
  cadProvider: 180,
  modernization: 30,
  activeRfp: 1,
  psapClassification: 365,
} as const;
