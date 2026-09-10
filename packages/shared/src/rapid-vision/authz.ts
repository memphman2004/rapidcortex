import { migrateLegacyRapidCortexRoleTokenValue } from "../auth/rapid-cortex-roles.js";
import { isRcInternalOperator, isRcsuperadmin } from "../tenancy/principal.js";
import type { UserContext } from "../types.js";

function role(user: Pick<UserContext, "role">): string {
  return migrateLegacyRapidCortexRoleTokenValue(String(user.role ?? "")) ?? String(user.role ?? "");
}

function roleUpper(user: Pick<UserContext, "role">): string {
  return String(user.role ?? "").toUpperCase();
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

function platformOverride(user: UserContext): boolean {
  return isRcsuperadmin(user) || isRcInternalOperator(user.role);
}

const VIEW_ROLES = new Set([
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "analyst",
  "auditor",
  "command",
]);

const VERIFY_ROLES = new Set(["dispatcher", "supervisor", "agencyadmin", "command"]);

const REQUEST_ROLES = new Set(["dispatcher", "supervisor", "agencyadmin", "agencyit", "command"]);

const ADMIN_ROLES = new Set(["agencyadmin", "agencyit"]);

const VERTICAL_VIEW = new Set([
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
  "VENUE_ADMIN",
  "VENUE_SUPERVISOR",
  "VENUE_SECURITY",
  "VENUE_OPERATOR",
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
]);

const VERTICAL_VERIFY = new Set([
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_DISPATCH",
  "VENUE_ADMIN",
  "VENUE_SUPERVISOR",
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
]);

const VERTICAL_ADMIN = new Set(["CAMPUS_ADMIN", "VENUE_ADMIN", "TRANSIT_ADMIN"]);

export function canViewVision(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const r = role(user);
  const u = roleUpper(user);
  return VIEW_ROLES.has(r) || VERTICAL_VIEW.has(u);
}

export function canRequestVisionAccess(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const r = role(user);
  const u = roleUpper(user);
  return REQUEST_ROLES.has(r) || VERTICAL_VIEW.has(u);
}

export function canVerifyVisionObservation(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const r = role(user);
  const u = roleUpper(user);
  return VERIFY_ROLES.has(r) || VERTICAL_VERIFY.has(u);
}

export function canAdminVision(user: UserContext, agencyId: string): boolean {
  if (platformOverride(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const r = role(user);
  const u = roleUpper(user);
  return ADMIN_ROLES.has(r) || VERTICAL_ADMIN.has(u);
}
