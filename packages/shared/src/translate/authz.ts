import {
  campusMatrixRoleFromRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "../auth/rapid-cortex-roles.js";
import { isRcInternalOperator, isRcsuperadmin } from "../tenancy/principal.js";
import type { UserContext } from "../types.js";
import type { TranslateVertical } from "./types.js";

function role(user: Pick<UserContext, "role">): string {
  return migrateLegacyRapidCortexRoleTokenValue(String(user.role ?? "")) ?? String(user.role ?? "");
}

/** Campus matrix family (`CAMPUS_ADMIN`) or raw uppercase for set membership. */
function campusFamilyOrUpper(user: Pick<UserContext, "role">): string {
  return campusMatrixRoleFromRole(user.role) ?? String(user.role ?? "").toUpperCase();
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

const LE_LINK = new Set(["dispatcher", "supervisor", "agencyadmin"]);
const LE_MONITOR = new Set([
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "analyst",
  "auditor",
]);
const LE_EXPORT = new Set(["supervisor", "agencyadmin", "analyst", "auditor"]);
const LE_CAD_APPROVE = new Set(["supervisor", "agencyadmin"]);

const VENUE_MONITOR = new Set([
  "venue_supervisor",
  "venue_admin",
  "agencyadmin",
  "agencyit",
  "analyst",
  "auditor",
  "transit_admin",
  "transit_supervisor",
]);

const CAMPUS_MONITOR = new Set([
  "CAMPUS_SUPERVISOR",
  "CAMPUS_ADMIN",
  "CAMPUS_DISPATCH",
  "CAMPUS_SECURITY",
  "CAMPUS_FACULTY",
]);

function platformOverride(user: UserContext): boolean {
  return isRcsuperadmin(user) || isRcInternalOperator(user.role);
}

/**
 * Field Translator start: any authenticated account in the target agency
 * (mobile + web field apps). RC platform operators may start for any agency.
 */
function canStartInAgency(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  return sameAgency(user, agencyId);
}

/** Any same-agency login can start a law-enforcement Translator session. */
export function canStartTranslateSession(user: UserContext, agencyId: string): boolean {
  return canStartInAgency(user, agencyId);
}

export function canSendTranslateLink(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return LE_LINK.has(role(user));
}

export function canMonitorTranslateSession(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return LE_MONITOR.has(role(user));
}

export function canExportTranslateSession(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return LE_EXPORT.has(role(user));
}

export function canApproveTranslateCadWriteback(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return LE_CAD_APPROVE.has(role(user));
}

export function canStartTranslateSessionVenue(user: UserContext, agencyId: string): boolean {
  return canStartInAgency(user, agencyId);
}

export function canMonitorTranslateSessionVenue(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return VENUE_MONITOR.has(role(user));
}

/**
 * Campus roles use product suffixes (`CAMPUS_SECURITY_K12`); compare matrix family.
 */
export function canStartTranslateSessionCampus(user: UserContext, agencyId: string): boolean {
  return canStartInAgency(user, agencyId);
}

export function canMonitorTranslateSessionCampus(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return CAMPUS_MONITOR.has(campusFamilyOrUpper(user));
}

export function canStartTranslateSessionHospital(user: UserContext, agencyId: string): boolean {
  return canStartInAgency(user, agencyId);
}

export function canStartTranslateSessionForVertical(
  user: UserContext,
  agencyId: string,
  vertical: TranslateVertical,
): boolean {
  switch (vertical) {
    case "law_enforcement":
      return canStartTranslateSession(user, agencyId);
    case "venue":
      return canStartTranslateSessionVenue(user, agencyId);
    case "campus":
      return canStartTranslateSessionCampus(user, agencyId);
    case "hospital":
      return canStartTranslateSessionHospital(user, agencyId);
  }
}

export function canMonitorTranslateSessionForVertical(
  user: UserContext,
  agencyId: string,
  vertical: TranslateVertical,
): boolean {
  switch (vertical) {
    case "law_enforcement":
      return canMonitorTranslateSession(user, agencyId);
    case "venue":
      return canMonitorTranslateSessionVenue(user, agencyId);
    case "campus":
      return canMonitorTranslateSessionCampus(user, agencyId);
    case "hospital":
      return canStartTranslateSessionHospital(user, agencyId);
  }
}

/** Agency-scoped YTD/MTD language-assistance counts for security dashboards. */
export function canViewTranslateAssistanceSummary(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return (
    canMonitorTranslateSessionCampus(user, agencyId) ||
    canStartTranslateSessionCampus(user, agencyId) ||
    canMonitorTranslateSessionVenue(user, agencyId) ||
    canStartTranslateSessionVenue(user, agencyId) ||
    canMonitorTranslateSession(user, agencyId)
  );
}
