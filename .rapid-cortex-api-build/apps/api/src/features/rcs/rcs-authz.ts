import type { UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin, migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared";

/**
 * RCS role gates. Canonical roles only — `commsupervisor` is accepted here strictly as the
 * deprecated legacy alias for `supervisor` (never emit it from new code; see `.cursorrules`).
 */
const RCS_MANAGE_ROLES = new Set([
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "rcadmin",
  "rcsuperadmin",
  "rcitadmin",
]);

/** Supervisor-tier and above — dispatchers may never override the closure gate. */
const RCS_OVERRIDE_ROLES = new Set([
  "supervisor",
  "agencyadmin",
  "rcadmin",
  "rcsuperadmin",
  "rcitadmin",
]);

const RCS_READ_ROLES = new Set([...RCS_MANAGE_ROLES, "analyst", "auditor"]);

function effectiveRcsRole(user: Pick<UserContext, "role">): string {
  const raw = String(user.role ?? "").trim();
  if (raw.toLowerCase() === "commsupervisor") return "supervisor";
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

/** Start/update/audio-alert/unit-position — frontline RCS operation. */
export function canManageRcsCall(user: UserContext): boolean {
  if (isRcsuperadmin(user)) return true;
  return RCS_MANAGE_ROLES.has(effectiveRcsRole(user));
}

/** Supervisor override of the closure gate, and supervisor acknowledgement. */
export function canSupervisorOverride(user: UserContext): boolean {
  if (isRcsuperadmin(user)) return true;
  return RCS_OVERRIDE_ROLES.has(effectiveRcsRole(user));
}

/** Read-only list/detail access (QA/analyst/audit surfaces included). */
export function canReadRcs(user: UserContext): boolean {
  if (isRcsuperadmin(user)) return true;
  return RCS_READ_ROLES.has(effectiveRcsRole(user));
}

/** Soft handoff request — assigned dispatcher or supervisor+. */
export function canRequestSoftHandoff(
  user: UserContext,
  assignedDispatcherId?: string,
): boolean {
  if (isRcsuperadmin(user)) return true;
  if (canSupervisorOverride(user)) return true;
  if (!canManageRcsCall(user)) return false;
  const role = effectiveRcsRole(user);
  if (role === "dispatcher") return user.userId === assignedDispatcherId;
  return true;
}

/** Accept handoff — any floor reader who is not the requester. */
export function canAcceptSoftHandoff(user: UserContext, requestedByUserId: string): boolean {
  if (!canReadRcs(user)) return false;
  return user.userId !== requestedByUserId;
}

export function canManageEscalationRules(user: UserContext): boolean {
  return canSupervisorOverride(user);
}

export function canViewFloorHealth(user: UserContext): boolean {
  return canSupervisorOverride(user);
}
