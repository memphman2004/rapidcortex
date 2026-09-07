import type { AgencyTenant } from "rapid-cortex-shared";
import {
  isTransitAssignableRole as isSharedTransitAssignableRole,
  type TransitAssignableRole as SharedTransitRole,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { extractTransitCode } from "@/lib/auth/post-login-redirect";
import { resolveAgencyVerticalFromTenant } from "@/lib/vertical";

export function canAccessTransitAdminRoutes(
  user: Pick<UserContext, "role" | "agencyId">,
  transitAgencyId: string,
): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toUpperCase() !== "TRANSIT_ADMIN") return false;
  return user.agencyId === transitAgencyId;
}

export function transitOrgCodeFromAgencyId(agencyId: string): string {
  return extractTransitCode(agencyId);
}

export function normalizeTransitCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

export function resolveTransitAgencyIdFromCode(
  agencies: readonly AgencyTenant[],
  transitCode: string,
): string | null {
  const target = normalizeTransitCode(transitCode);
  for (const agency of agencies) {
    const vertical = resolveAgencyVerticalFromTenant(agency);
    if (vertical !== "transit" && agency.type !== "transit") continue;
    if (transitOrgCodeFromAgencyId(agency.agencyId) === target) return agency.agencyId;
  }
  return null;
}

export function isTransitAssignableRole(role: string): boolean {
  return isSharedTransitAssignableRole(role);
}

export const TRANSIT_ASSIGNABLE_ROLES = [
  {
    value: "TRANSIT_ADMIN" as const,
    label: "Transit Admin",
    description: "Full admin — fleet, QR, users, settings, incidents",
  },
  {
    value: "TRANSIT_SUPERVISOR" as const,
    label: "Transit Supervisor",
    description: "Ops dashboard, incidents, QR, cameras, broadcasts",
  },
  {
    value: "TRANSIT_SECURITY" as const,
    label: "Transit Security",
    description: "Incidents, fleet view, live cameras, NFC program",
  },
  {
    value: "TRANSIT_OPERATOR" as const,
    label: "Transit Operator",
    description: "Assigned vehicle, incident report, cameras on vehicle",
  },
] as const;

export type TransitAssignableRole = (typeof TRANSIT_ASSIGNABLE_ROLES)[number]["value"];

export const TRANSIT_ROLE_LABELS: Record<TransitAssignableRole, string> = {
  TRANSIT_ADMIN: "Transit Admin",
  TRANSIT_SUPERVISOR: "Supervisor",
  TRANSIT_SECURITY: "Security",
  TRANSIT_OPERATOR: "Operator",
};

export const TRANSIT_ROLE_COLORS: Record<TransitAssignableRole, string> = {
  TRANSIT_ADMIN: "bg-sky-700 text-white",
  TRANSIT_SUPERVISOR: "bg-sky-800 text-sky-100",
  TRANSIT_SECURITY: "bg-slate-800 text-slate-200",
  TRANSIT_OPERATOR: "bg-slate-800 text-slate-300",
};

export type TransitRoleToken = SharedTransitRole;
