import type { UserRole } from "rapid-cortex-shared/types";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

/** Signal band accent per role — used by vertical dashboards and Cortex Console chrome. */
export const ROLE_BAND_COLORS: Partial<Record<UserRole, string>> & Record<string, string> = {
  // Platform
  rcsuperadmin: "#C084FC",
  rcadmin: "#0EA5E9",
  rcitadmin: "#06B6D4",
  // 911
  agencyadmin: "#10B981",
  agencyit: "#14B8A6",
  supervisor: "#F59E0B",
  dispatcher: "#0284C7",
  analyst: "#2DD4BF",
  auditor: "#F87171",
  // Campus — emerald (education)
  campus_admin: "#10B981",
  campus_supervisor: "#10B981",
  campus_security: "#10B981",
  campus_counselor: "#10B981",
  campus_faculty: "#10B981",
  // Venue — amber (events)
  venue_admin: "#F59E0B",
  venue_supervisor: "#F59E0B",
  venue_security: "#F59E0B",
  venue_operator: "#F59E0B",
  venue_guest: "#F59E0B",
  // Hospital — red (medical)
  hospital_admin: "#EF4444",
  hospital_supervisor: "#EF4444",
  hospital_staff: "#EF4444",
  hospital_coord: "#EF4444",
  hospitaladmin: "#EF4444",
  hospitalstaff: "#EF4444",
  // Transit — indigo
  transit_admin: "#6366F1",
  transit_supervisor: "#6366F1",
  transit_security: "#6366F1",
  transit_operator: "#6366F1",
};

export function roleBandColor(role: string | null | undefined): string {
  const token = migrateLegacyRapidCortexRoleTokenValue(role?.trim() ?? "") ?? role?.trim() ?? "";
  return ROLE_BAND_COLORS[token] ?? "#64748B";
}
