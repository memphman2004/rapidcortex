import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";

export function normalizeCampusCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** True when the signed-in user may access data for this campus org code. */
export function canAccessCampusTenant(user: UserContext, campusCode: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  const agencyId = user.agencyId ?? "";
  const normalizedAgency = agencyId.replace(/^(test-)?campus-/, "").toUpperCase().replace(/-/g, "");
  return normalizedAgency === normalizeCampusCode(campusCode);
}
