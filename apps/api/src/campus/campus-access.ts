import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";

export function normalizeCampusCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** Org code embedded in campus agencyIds (e.g. last-campus-uga / test-campus-uga → UGA). */
export function campusCodeFromAgencyId(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?campus-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

/** True when the signed-in user may access data for this campus org code. */
export function canAccessCampusTenant(user: UserContext, campusCode: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  const agencyId = user.agencyId ?? "";
  if (!agencyId) return false;
  return campusCodeFromAgencyId(agencyId) === normalizeCampusCode(campusCode);
}
