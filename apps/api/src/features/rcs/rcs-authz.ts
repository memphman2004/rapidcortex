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
const RCS_OVERRIDE_ROLES = new Set(["supervisor", "agencyadmin", "rcadmin", "rcsuperadmin", "rcitadmin"]);

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
