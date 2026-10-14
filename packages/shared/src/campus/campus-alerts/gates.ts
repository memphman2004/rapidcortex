import { resolveCampusInstitutionType } from "../institution-type.js";

/**
 * NexCort iQ Campus Alerts — eligibility (backend + UI must both enforce).
 * Higher-education Campus only. Never K-12, venue, transit, or PSAP.
 */
export function isCampusAlertsHigherEdCampus(opts: {
  vertical?: string | null;
  agencyType?: string | null;
  institutionType?: unknown;
  campusType?: unknown;
}): boolean {
  const vertical = String(opts.vertical ?? "").trim().toLowerCase();
  const agencyType = String(opts.agencyType ?? "").trim().toLowerCase();
  const isCampus =
    vertical === "campus" ||
    agencyType === "campus" ||
    (!vertical && !agencyType && Boolean(opts.institutionType || opts.campusType));
  if (agencyType && agencyType !== "campus") return false;
  if (vertical && vertical !== "campus") return false;
  if (!isCampus && !opts.institutionType && !opts.campusType) return false;
  return (
    resolveCampusInstitutionType({
      institutionType: opts.institutionType,
      campusType: opts.campusType,
    }) === "higher_ed"
  );
}

export function assertCampusAlertsHigherEdCampus(opts: {
  vertical?: string | null;
  agencyType?: string | null;
  institutionType?: unknown;
  campusType?: unknown;
}): void {
  if (!isCampusAlertsHigherEdCampus(opts)) {
    const err = new Error("CAMPUS_ALERTS_NOT_AVAILABLE_FOR_TENANT");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

/** Platform + tenant must both be on. Platform flag is fail-closed (caller supplies). */
export function isCampusAlertsFeatureEnabled(opts: {
  platformEnabled: boolean;
  tenantEnabled?: boolean | null;
  selfRegistrationEnabled?: boolean | null;
  vertical?: string | null;
  agencyType?: string | null;
  institutionType?: unknown;
  campusType?: unknown;
}): boolean {
  if (!opts.platformEnabled) return false;
  if (opts.tenantEnabled === false) return false;
  if (opts.selfRegistrationEnabled === false) return false;
  return isCampusAlertsHigherEdCampus(opts);
}

/**
 * Roles that may initiate emergency mass SMS (server must still check HE + flags + classification).
 * CAMPUS_SECURITY cannot publish mass SMS.
 */
export function canInitiateCampusAlertsEmergencySms(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/_(K12|HIGHERED)$/i, "");
  if (r === "RCSUPERADMIN" || r === "RCADMIN") return true;
  return r === "CAMPUS_ADMIN" || r === "CAMPUS_SUPERVISOR" || r === "CAMPUS_DISPATCH";
}
