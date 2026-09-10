import { migrateLegacyRapidCortexRoleTokenValue } from "../auth/rapid-cortex-roles.js";
import { isRcInternalOperator, isRcsuperadmin } from "../tenancy/principal.js";
import type { UserContext } from "../types.js";
import type { TranslateVertical } from "./types.js";

function role(user: Pick<UserContext, "role">): string {
  return migrateLegacyRapidCortexRoleTokenValue(String(user.role ?? "")) ?? String(user.role ?? "");
}

function roleUpper(user: Pick<UserContext, "role">): string {
  return String(user.role ?? "").toUpperCase();
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

const LE_START = new Set(["dispatcher", "supervisor", "agencyadmin", "officer"]);
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

const VENUE_START = new Set([
  "venue_supervisor",
  "venue_staff",
  "venue_operator",
  "venue_security",
  "venue_admin",
  "agencyadmin",
  "agencyit",
]);
const VENUE_MONITOR = new Set([
  "venue_supervisor",
  "venue_admin",
  "agencyadmin",
  "agencyit",
  "analyst",
  "auditor",
]);

const CAMPUS_START = new Set([
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_ADMIN",
  "CAMPUS_COUNSELOR",
]);
const CAMPUS_MONITOR = new Set([
  "CAMPUS_SUPERVISOR",
  "CAMPUS_ADMIN",
  "CAMPUS_DISPATCH",
  "CAMPUS_SECURITY",
  "CAMPUS_FACULTY",
]);

const HOSPITAL_START = new Set([
  "hospitalstaff",
  "hospitaladmin",
  "hospital_staff",
  "hospital_admin",
  "hospital_coord",
]);

function platformOverride(user: UserContext): boolean {
  return isRcsuperadmin(user) || isRcInternalOperator(user.role);
}

/** Officers, dispatchers, supervisors, and admins can start a session. */
export function canStartTranslateSession(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return LE_START.has(role(user));
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
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return VENUE_START.has(role(user));
}

export function canMonitorTranslateSessionVenue(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return VENUE_MONITOR.has(role(user));
}

/**
 * Campus Cognito groups are uppercase (`CAMPUS_SECURITY`). Compare the raw claim
 * after toUpperCase so snake_case JWTs still match.
 */
export function canStartTranslateSessionCampus(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return CAMPUS_START.has(roleUpper(user));
}

export function canMonitorTranslateSessionCampus(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return CAMPUS_MONITOR.has(roleUpper(user));
}

export function canStartTranslateSessionHospital(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const r = role(user);
  return HOSPITAL_START.has(r) || HOSPITAL_START.has(r.replace(/_/g, ""));
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
