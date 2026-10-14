import type { CampusInstitutionType } from "../institution-type.js";
import { resolveCampusInstitutionType } from "../institution-type.js";

/**
 * Escort iQ™ — eligibility gate (backend + UI must both enforce).
 * Higher-education Campus only. Never K-12, venue, transit, or PSAP.
 */
export function isEscortIqHigherEdCampus(opts: {
  vertical?: string | null;
  agencyType?: string | null;
  institutionType?: unknown;
  campusType?: unknown;
}): boolean {
  const vertical = String(opts.vertical ?? "").trim().toLowerCase();
  const agencyType = String(opts.agencyType ?? "").trim().toLowerCase();
  const isCampus =
    vertical === "campus" || agencyType === "campus" || (!vertical && !agencyType && Boolean(opts.institutionType || opts.campusType));
  if (agencyType && agencyType !== "campus") return false;
  if (vertical && vertical !== "campus") return false;
  if (!isCampus && !opts.institutionType && !opts.campusType) return false;
  const institution = resolveCampusInstitutionType({
    institutionType: opts.institutionType,
    campusType: opts.campusType,
  });
  return institution === "higher_ed";
}

export function assertEscortIqHigherEdCampus(opts: {
  vertical?: string | null;
  agencyType?: string | null;
  institutionType?: unknown;
  campusType?: unknown;
}): void {
  if (!isEscortIqHigherEdCampus(opts)) {
    const err = new Error("ESCORT_IQ_NOT_AVAILABLE_FOR_TENANT");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

/** Platform + tenant must both be on. Platform flag is fail-closed (caller supplies). */
export function isEscortIqEnabled(opts: {
  platformEnabled: boolean;
  tenantEnabled?: boolean | null;
  vertical?: string | null;
  agencyType?: string | null;
  institutionType?: unknown;
  campusType?: unknown;
}): boolean {
  if (!opts.platformEnabled) return false;
  if (opts.tenantEnabled === false) return false;
  return isEscortIqHigherEdCampus(opts);
}

export type EscortIqInstitutionGate = {
  institutionType: CampusInstitutionType;
  allowed: boolean;
};
