/**
 * AI Feature Gate — server-side RBAC.
 * Toggle: supervisor / agencyadmin / RC internal. Dispatchers cannot toggle.
 * Read: any authenticated same-agency member (+ RC internal).
 */

import type { UserContext } from "rapid-cortex-shared/types";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";

function normalizedRole(user: Pick<UserContext, "role">): string {
  const raw = String(user.role ?? "").trim();
  if (raw.toLowerCase() === "commsupervisor") return "supervisor";
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

export function canToggleAIGate(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (isRcInternalOperator(user.role)) return true;
  if (!sameAgency(user, agencyId)) return false;

  const role = normalizedRole(user);
  return role === "supervisor" || role === "agencyadmin" || role === "agencyit";
}

export function canReadAIGateConfig(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (isRcInternalOperator(user.role)) return true;
  return sameAgency(user, agencyId);
}
