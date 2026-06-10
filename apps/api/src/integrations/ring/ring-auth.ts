import type { UserContext } from "rapid-cortex-shared";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared";

/**
 * Spec role names plus canonical Rapid Cortex roles that satisfy the same intent.
 * `command` / `admin` → agency command staff; `emergency_manager` → supervisor;
 * `rc_admin` → platform RC admin.
 */
const RING_AUTHORIZED_ROLE_TOKENS = new Set([
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "rcadmin",
  "rcsuperadmin",
  "rcitadmin",
  "VENUE_SUPERVISOR",
  "VENUE_ADMIN",
]);

export function isRingAuthorizedRole(user: UserContext): boolean {
  if (RING_AUTHORIZED_ROLE_TOKENS.has(user.role)) return true;
  const migrated = migrateLegacyRapidCortexRoleTokenValue(user.role);
  return migrated ? RING_AUTHORIZED_ROLE_TOKENS.has(migrated) : false;
}
