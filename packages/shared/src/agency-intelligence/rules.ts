import { SALES_TERRITORY_STATE_CODES, SALES_TERRITORY_ZONES } from "../sales/sales-territory-zones.js";
import type { SalesTerritoryZoneDef, SalesTerritoryZoneId } from "../sales/sales-territory-zones.js";
import type {
  AgencyIntelligenceProfile,
  HeadcountBasis,
  StaffingIntelligence,
  AgencyIntelligenceVerificationStatus,
} from "./types.js";
import { DEFAULT_FRESHNESS_DAYS, QUALIFYING_VERIFICATION_STATUSES } from "./types.js";

const QUALIFYING = new Set<AgencyIntelligenceVerificationStatus>(QUALIFYING_VERIFICATION_STATUSES);

export function isQualifyingVerification(status: AgencyIntelligenceVerificationStatus): boolean {
  return QUALIFYING.has(status);
}

/**
 * Missing numbers stay null. Zero is a real reported value and is preserved.
 * Never coerce null to 0.
 */
export function formatIntelligenceCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Unknown";
  return String(value);
}

export function formatIntelligenceText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Unknown";
}

/**
 * Vacancy percentage is calculated only when authorized and filled positions
 * are both verified and comparable. Headcount is not a substitute for either.
 */
export function vacancyPercentage(
  staffing: Pick<StaffingIntelligence, "authorizedDispatcherPositions" | "filledDispatcherPositions">,
): number | null {
  const authorized = staffing.authorizedDispatcherPositions;
  const filled = staffing.filledDispatcherPositions;
  if (!isQualifyingVerification(authorized.verificationStatus)) return null;
  if (!isQualifyingVerification(filled.verificationStatus)) return null;
  if (authorized.value == null || filled.value == null) return null;
  if (!Number.isInteger(authorized.value) || !Number.isInteger(filled.value)) return null;
  if (authorized.value <= 0 || filled.value < 0 || filled.value > authorized.value) return null;
  return Math.round(((authorized.value - filled.value) / authorized.value) * 1000) / 10;
}

/**
 * The default filter uses one reported headcount of distinct dispatch personnel.
 * It does not add full-time, part-time, supervisor, console, or on-duty figures together.
 */
export function eligibleStaffingCount(
  staffing: StaffingIntelligence,
  basis: HeadcountBasis,
  allowUnverified: boolean,
): number | null {
  if (basis === "AUTHORIZED_POSITIONS") {
    const fact = staffing.authorizedDispatcherPositions;
    if (fact.value == null) return null;
    if (!allowUnverified && !isQualifyingVerification(fact.verificationStatus)) return null;
    return fact.value;
  }
  if (basis === "FTE") {
    const fact = staffing.dispatcherFte;
    if (fact.value == null) return null;
    if (!allowUnverified && !isQualifyingVerification(fact.verificationStatus)) return null;
    return fact.value;
  }
  const fact = staffing.reportedDispatcherHeadcount;
  if (fact.value == null) return null;
  if (fact.countingMethod !== "DISTINCT_DISPATCH_PERSONNEL") return null;
  if (!allowUnverified && !isQualifyingVerification(fact.verificationStatus)) return null;
  return fact.value;
}

export function salesZoneForState(state: string | null | undefined): SalesTerritoryZoneDef | null {
  const code = state?.trim().toUpperCase();
  if (!code) return null;
  return SALES_TERRITORY_ZONES.find((zone) => zone.states.includes(code)) ?? null;
}

export function isUnitedStatesState(state: string | null | undefined): boolean {
  const code = state?.trim().toUpperCase() ?? "";
  return (SALES_TERRITORY_STATE_CODES as readonly string[]).includes(code);
}

export function salesZoneIdForState(state: string | null | undefined): SalesTerritoryZoneId | null {
  return salesZoneForState(state)?.id ?? null;
}

function parseIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function isOlderThanDays(
  isoDate: string | null | undefined,
  nowIso: string,
  days: number,
): boolean {
  const then = parseIso(isoDate);
  const now = parseIso(nowIso);
  if (then == null || now == null) return false;
  return now - then > days * 24 * 60 * 60 * 1000;
}

export type FreshnessFlag = {
  field: string;
  stale: boolean;
};

/** Read-time freshness. Does not invent a new value or write a refresh. */
export function freshnessFlags(profile: AgencyIntelligenceProfile, nowIso: string): FreshnessFlag[] {
  const flags: FreshnessFlag[] = [];
  const staffingDate = profile.staffing.reportedDispatcherHeadcount.reportDate;
  flags.push({
    field: "reportedDispatcherHeadcount",
    stale: isOlderThanDays(staffingDate, nowIso, DEFAULT_FRESHNESS_DAYS.staffing),
  });
  flags.push({
    field: "dispatcherVacancies",
    stale: isOlderThanDays(
      profile.staffing.dispatcherVacancies.reportDate,
      nowIso,
      DEFAULT_FRESHNESS_DAYS.vacancies,
    ),
  });
  flags.push({
    field: "psapClassification",
    stale: isOlderThanDays(
      profile.psapClassification.reportDate,
      nowIso,
      DEFAULT_FRESHNESS_DAYS.psapClassification,
    ),
  });
  flags.push({
    field: "annual911Calls",
    stale: isOlderThanDays(
      profile.callVolume.annual911Calls.reportDate,
      nowIso,
      DEFAULT_FRESHNESS_DAYS.callVolume,
    ),
  });
  flags.push({
    field: "cadProvider",
    stale: isOlderThanDays(
      profile.technology.cadProvider.reportDate,
      nowIso,
      DEFAULT_FRESHNESS_DAYS.cadProvider,
    ),
  });
  return flags.filter((flag) => flag.stale);
}

export function averageDailyCallVolume(
  annual: number | null,
  reportingYear: number | null,
): number | null {
  if (annual == null || reportingYear == null) return null;
  if (!Number.isInteger(annual) || annual < 0) return null;
  if (!Number.isInteger(reportingYear) || reportingYear < 1990 || reportingYear > 2100) return null;
  const leap = reportingYear % 4 === 0 && (reportingYear % 100 !== 0 || reportingYear % 400 === 0);
  const days = leap ? 366 : 365;
  return Math.round((annual / days) * 10) / 10;
}

/**
 * A record labeled open is not treated as open after the submission deadline.
 * Awarded and canceled procurements are not open solicitations.
 * Missing deadline stays unknown rather than assumed open.
 */
export function effectiveActiveRfp(
  profile: AgencyIntelligenceProfile,
  nowIso: string,
): boolean | null {
  const status = profile.modernization.status.value;
  if (status === "AWARDED" || status === "CANCELED" || status === "NONE_REPORTED") return false;
  const flagged = profile.modernization.activeRfp.value;
  if (flagged == null) return null;
  if (!flagged) return false;
  const deadline = profile.modernization.rfpDeadline;
  if (!deadline) return null;
  const deadlineMs = parseIso(deadline);
  const now = parseIso(nowIso);
  if (deadlineMs == null || now == null) return null;
  return deadlineMs >= now;
}
