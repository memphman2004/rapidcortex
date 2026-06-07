import type { Incident, UserContext, UserRole } from "rapid-cortex-shared";
import {
  isRcsuperadmin,
  normalizeSessionRole,
} from "rapid-cortex-shared";
import { TenantAccessGuard } from "rapid-cortex-security";

export function normalizeRole(value: string | undefined): UserRole {
  return normalizeSessionRole(value) as UserRole;
}

export function requireRole(user: UserContext, allowed: UserRole[]): boolean {
  return allowed.includes(user.role);
}

export async function getIncidentForUser(
  incidentRepo: { get(incidentId: string): Promise<Incident | null> },
  incidentId: string,
  user: UserContext,
): Promise<Incident | null> {
  const incident = await incidentRepo.get(incidentId);
  if (!incident) return null;
  if (isRcsuperadmin(user)) return incident;
  if (!TenantAccessGuard.isSameAgency(incident.agencyId, user.agencyId)) return null;
  return incident;
}
