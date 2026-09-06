import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";

function normalizedRole(user: Pick<UserContext, "role">): string {
  const raw = String(user.role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

export function canViewCadIncidents(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const role = normalizedRole(user);
  return (
    role === "dispatcher" ||
    role === "supervisor" ||
    role === "agencyadmin" ||
    role === "agencyit" ||
    role === "analyst" ||
    role === "auditor" ||
    role === "rcadmin"
  );
}

export function canSubmitWriteBack(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const role = normalizedRole(user);
  return role === "dispatcher" || role === "supervisor" || role === "agencyadmin" || role === "agencyit";
}

export function canApproveWriteBack(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const role = normalizedRole(user);
  return role === "supervisor" || role === "agencyadmin" || role === "agencyit" || role === "rcadmin";
}

export function canManageCadConnectors(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const role = normalizedRole(user);
  return role === "agencyadmin" || role === "agencyit" || role === "rcadmin";
}

export function canDeleteCadConnectors(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const role = normalizedRole(user);
  return role === "agencyit" || role === "rcadmin";
}

export function canViewCadAudit(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  const role = normalizedRole(user);
  return role === "supervisor" || role === "agencyadmin" || role === "agencyit" || role === "analyst" || role === "auditor" || role === "rcadmin";
}

export function canManageCadRouting(user: UserContext, agencyId: string): boolean {
  return canManageCadConnectors(user, agencyId);
}
