import type { SalesTerritoryZoneId } from "../sales/sales-territory-zones.js";
import type {
  AgencyIntelligenceProfile,
  HeadcountBasis,
  SavedPsapFilter,
} from "./types.js";
import {
  effectiveActiveRfp,
  eligibleStaffingCount,
  formatIntelligenceCount,
  formatIntelligenceText,
  freshnessFlags,
  isQualifyingVerification,
  isUnitedStatesState,
  salesZoneForState,
} from "./rules.js";

export const SMALL_PRIMARY_PSAP_FILTER: SavedPsapFilter = {
  id: "small-primary-psaps-7",
  name: "Small Primary PSAPs — 7 or Fewer Dispatchers",
  psapType: "PRIMARY",
  maximumDispatcherHeadcount: 7,
  headcountBasis: "DISTINCT_DISPATCH_PERSONNEL",
  minimumVacancies: null,
  modernizationStatus: "ANY",
  geography: "UNITED_STATES",
  includeUnverifiedStaffingInQualifiedResults: false,
  includeUnverifiedPrimaryStatus: false,
  sortBy: "opportunityScore",
  sortDirection: "DESC",
};

export type ResearchReason =
  | "UNCONFIRMED_PRIMARY"
  | "UNKNOWN_HEADCOUNT"
  | "STALE_STAFFING"
  | "MISSING_REPORTING_PERIOD"
  | "CONFLICTING_HEADCOUNT"
  | "UNKNOWN_VACANCIES";

export type ProspectBucket = "qualified" | "research" | "excluded";

export type ProspectingSubject = {
  psapId: string;
  agencyName: string;
  state: string;
  county: string;
  city: string;
  outreachStatus: string;
  assignedToName?: string | null;
  nextActionNote?: string | null;
  nextActionDate?: string | null;
  profile: AgencyIntelligenceProfile | null;
};

export type ProspectClassification = {
  bucket: ProspectBucket;
  reasons: ResearchReason[];
  exclusion: string | null;
  headcount: number | null;
  primaryVerified: boolean;
};

export type ProspectingListFilters = {
  state?: string;
  county?: string;
  salesZone?: SalesTerritoryZoneId;
  cadVendor?: string;
  headcountBasis?: HeadcountBasis;
};

function primaryGate(
  profile: AgencyIntelligenceProfile | null,
  filter: SavedPsapFilter,
): { ok: boolean; verified: boolean; research: boolean; exclusion: string | null } {
  if (!profile || profile.psapClassification.value == null || profile.psapClassification.value === "UNKNOWN") {
    return { ok: false, verified: false, research: true, exclusion: null };
  }
  const classification = profile.psapClassification.value;
  const verified =
    filter.includeUnverifiedPrimaryStatus ||
    isQualifyingVerification(profile.psapClassification.verificationStatus);
  if (classification === "CLOSED_MERGED_INACTIVE") {
    return { ok: false, verified, research: false, exclusion: "CLOSED_OR_INACTIVE" };
  }
  if (classification === "SECONDARY") {
    return { ok: false, verified, research: false, exclusion: "NOT_PRIMARY" };
  }
  if (classification === "CONSOLIDATED_REGIONAL") {
    const receiving = profile.primaryReceivingPoint.value === true;
    const receivingVerified =
      filter.includeUnverifiedPrimaryStatus ||
      isQualifyingVerification(profile.primaryReceivingPoint.verificationStatus);
    if (receiving && receivingVerified && verified) {
      return { ok: true, verified: true, research: false, exclusion: null };
    }
    return { ok: false, verified: false, research: true, exclusion: null };
  }
  if (classification === "PRIMARY" && verified) {
    return { ok: true, verified: true, research: false, exclusion: null };
  }
  return { ok: false, verified: false, research: true, exclusion: null };
}

export function classifyProspect(
  subject: ProspectingSubject,
  filter: SavedPsapFilter,
  nowIso: string,
): ProspectClassification {
  const reasons: ResearchReason[] = [];
  if (!isUnitedStatesState(subject.state) && filter.geography === "UNITED_STATES") {
    return { bucket: "excluded", reasons, exclusion: "OUTSIDE_GEOGRAPHY", headcount: null, primaryVerified: false };
  }

  const primary = primaryGate(subject.profile, filter);
  if (primary.exclusion) {
    return {
      bucket: "excluded",
      reasons,
      exclusion: primary.exclusion,
      headcount: null,
      primaryVerified: primary.verified,
    };
  }
  if (!primary.ok) reasons.push("UNCONFIRMED_PRIMARY");

  const basis = filter.headcountBasis;
  const staffing = subject.profile?.staffing;
  const headcount = staffing
    ? eligibleStaffingCount(staffing, basis, filter.includeUnverifiedStaffingInQualifiedResults)
    : null;

  if (headcount == null) {
    const method = staffing?.reportedDispatcherHeadcount.countingMethod;
    const raw = staffing?.reportedDispatcherHeadcount.value;
    if (
      basis === "DISTINCT_DISPATCH_PERSONNEL" &&
      raw != null &&
      method &&
      method !== "DISTINCT_DISPATCH_PERSONNEL"
    ) {
      reasons.push("UNKNOWN_HEADCOUNT");
    } else if (staffing?.reportedDispatcherHeadcount.verificationStatus === "CONFLICTING") {
      reasons.push("CONFLICTING_HEADCOUNT");
    } else {
      reasons.push("UNKNOWN_HEADCOUNT");
    }
  } else if (primary.ok && headcount > filter.maximumDispatcherHeadcount) {
    return {
      bucket: "excluded",
      reasons,
      exclusion: "ABOVE_HEADCOUNT_MAXIMUM",
      headcount,
      primaryVerified: primary.ok,
    };
  } else if (primary.ok && basis === "DISTINCT_DISPATCH_PERSONNEL") {
    const fact = staffing?.reportedDispatcherHeadcount;
    if (!fact?.reportingPeriod && !fact?.reportDate) reasons.push("MISSING_REPORTING_PERIOD");
    if (
      subject.profile &&
      freshnessFlags(subject.profile, nowIso).some((flag) => flag.field === "reportedDispatcherHeadcount")
    ) {
      reasons.push("STALE_STAFFING");
    }
  }

  if (filter.minimumVacancies != null) {
    const vacancies = staffing?.dispatcherVacancies;
    const known =
      vacancies != null &&
      vacancies.value != null &&
      (filter.includeUnverifiedStaffingInQualifiedResults ||
        isQualifyingVerification(vacancies.verificationStatus));
    if (!known) reasons.push("UNKNOWN_VACANCIES");
    else if ((vacancies?.value ?? 0) < filter.minimumVacancies) {
      return {
        bucket: "excluded",
        reasons,
        exclusion: "BELOW_VACANCY_MINIMUM",
        headcount,
        primaryVerified: primary.verified,
      };
    }
  }

  if (reasons.length > 0 || !primary.ok) {
    return { bucket: "research", reasons, exclusion: null, headcount, primaryVerified: primary.ok };
  }
  return { bucket: "qualified", reasons: [], exclusion: null, headcount, primaryVerified: true };
}

export type ProspectingRow = {
  psapId: string;
  agencyName: string;
  state: string;
  county: string;
  city: string;
  salesZoneId: SalesTerritoryZoneId | null;
  salesZoneName: string | null;
  psapClassification: string;
  classificationVerification: string;
  dispatcherHeadcount: string;
  headcountValue: number | null;
  countingMethod: string | null;
  reportingPeriod: string | null;
  authorizedStaffing: string;
  vacancies: string;
  annual911Calls: string;
  annualAdministrativeCalls: string;
  cadProvider: string;
  namedBidders: string[];
  modernizationStatus: string;
  activeRfp: string;
  opportunityScore: null;
  dataConfidence: string;
  assignedRepresentative: string;
  lastVerified: string | null;
  nextAction: string | null;
  bucket: ProspectBucket;
  researchReasons: ResearchReason[];
  exclusion: string | null;
};

function confidence(profile: AgencyIntelligenceProfile | null, classification: ProspectClassification): string {
  if (!profile) return "Unknown";
  if (classification.reasons.includes("CONFLICTING_HEADCOUNT")) return "Conflicting";
  if (classification.reasons.includes("STALE_STAFFING")) return "Stale";
  if (classification.bucket === "qualified") return "Verified";
  if (classification.reasons.length > 0) return "Research required";
  return "Unknown";
}

export function toProspectingRow(
  subject: ProspectingSubject,
  filter: SavedPsapFilter,
  nowIso: string,
): ProspectingRow {
  const classification = classifyProspect(subject, filter, nowIso);
  const profile = subject.profile;
  const zone = salesZoneForState(subject.state);
  const staffing = profile?.staffing;
  const active = profile ? effectiveActiveRfp(profile, nowIso) : null;
  return {
    psapId: subject.psapId,
    agencyName: subject.agencyName,
    state: subject.state,
    county: subject.county,
    city: subject.city,
    salesZoneId: zone?.id ?? null,
    salesZoneName: zone?.name ?? null,
    psapClassification: profile?.psapClassification.value ?? "UNKNOWN",
    classificationVerification: profile?.psapClassification.verificationStatus ?? "UNKNOWN",
    dispatcherHeadcount: formatIntelligenceCount(classification.headcount),
    headcountValue: classification.headcount,
    countingMethod: staffing?.reportedDispatcherHeadcount.countingMethod ?? null,
    reportingPeriod: staffing?.reportedDispatcherHeadcount.reportingPeriod ?? null,
    authorizedStaffing: formatIntelligenceCount(staffing?.authorizedDispatcherPositions.value),
    vacancies: formatIntelligenceCount(staffing?.dispatcherVacancies.value),
    annual911Calls: formatIntelligenceCount(profile?.callVolume.annual911Calls.value),
    annualAdministrativeCalls: formatIntelligenceCount(profile?.callVolume.annualAdministrativeCalls.value),
    cadProvider: formatIntelligenceText(profile?.technology.cadProvider.value),
    namedBidders: profile?.technology.namedBidders ?? [],
    modernizationStatus: profile?.modernization.status.value ?? "UNKNOWN",
    activeRfp: active == null ? "Unknown" : active ? "Open" : "Not open",
    opportunityScore: null,
    dataConfidence: confidence(profile, classification),
    assignedRepresentative: subject.assignedToName?.trim() || "Unassigned",
    lastVerified: staffing?.reportedDispatcherHeadcount.reportDate ?? profile?.psapClassification.reportDate ?? null,
    nextAction: subject.nextActionNote?.trim() || null,
    bucket: classification.bucket,
    researchReasons: classification.reasons,
    exclusion: classification.exclusion,
  };
}

export function matchesListFilters(row: ProspectingRow, filters: ProspectingListFilters): boolean {
  if (filters.state && row.state.toUpperCase() !== filters.state.toUpperCase()) return false;
  if (filters.county && row.county.toLowerCase() !== filters.county.toLowerCase()) return false;
  if (filters.salesZone && row.salesZoneId !== filters.salesZone) return false;
  if (filters.cadVendor) {
    const vendor = filters.cadVendor.trim().toLowerCase();
    if (row.cadProvider.toLowerCase() !== vendor) return false;
  }
  return true;
}

export function sortProspectingRows(rows: ProspectingRow[], filter: SavedPsapFilter): ProspectingRow[] {
  const direction = filter.sortDirection === "ASC" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (filter.sortBy === "state") return a.state.localeCompare(b.state) * direction;
    if (filter.sortBy === "agencyName") return a.agencyName.localeCompare(b.agencyName) * direction;
    // Opportunity score is not calculated in Phase 1. Fall back to agency name.
    return a.agencyName.localeCompare(b.agencyName);
  });
}

export function buildProspectingRows(
  subjects: ProspectingSubject[],
  filter: SavedPsapFilter,
  listFilters: ProspectingListFilters,
  nowIso: string,
  view: ProspectBucket,
): ProspectingRow[] {
  const activeFilter: SavedPsapFilter = listFilters.headcountBasis
    ? { ...filter, headcountBasis: listFilters.headcountBasis }
    : filter;
  const rows = subjects
    .map((subject) => toProspectingRow(subject, activeFilter, nowIso))
    .filter((row) => row.bucket === view)
    .filter((row) => matchesListFilters(row, listFilters));
  return sortProspectingRows(rows, activeFilter);
}

const CSV_HEADERS = [
  "Agency",
  "State",
  "County",
  "Sales zone",
  "PSAP type",
  "Classification verification",
  "Dispatcher headcount",
  "Counting method",
  "Reporting period",
  "Authorized staffing",
  "Vacancies",
  "Annual 911 calls",
  "Annual administrative calls",
  "CAD provider",
  "Modernization status",
  "Active RFP",
  "Opportunity score",
  "Data confidence",
  "Assigned representative",
  "Last verified",
  "Next action",
];

function csvCell(value: unknown): string {
  const text = value == null || value === "" ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function prospectingRowsToCsv(rows: ProspectingRow[]): string {
  const lines = rows.map((row) =>
    [
      row.agencyName,
      row.state,
      row.county,
      row.salesZoneName ?? "Unknown",
      row.psapClassification,
      row.classificationVerification,
      row.dispatcherHeadcount,
      row.countingMethod ?? "Unknown",
      row.reportingPeriod ?? "Unknown",
      row.authorizedStaffing,
      row.vacancies,
      row.annual911Calls,
      row.annualAdministrativeCalls,
      row.cadProvider,
      row.modernizationStatus,
      row.activeRfp,
      "Unknown",
      row.dataConfidence,
      row.assignedRepresentative,
      row.lastVerified ?? "Unknown",
      row.nextAction ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_HEADERS.join(","), ...lines].join("\n");
}
