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
  // Campus — slate
  campus_admin: "#64748B",
  campus_supervisor: "#64748B",
  campus_security: "#64748B",
  campus_counselor: "#64748B",
  campus_faculty: "#64748B",
  // Venue — orange
  venue_admin: "#F97316",
  venue_supervisor: "#F97316",
  venue_security: "#F97316",
  venue_operator: "#F97316",
  venue_guest: "#F97316",
  // Hospital — teal
  hospital_admin: "#14B8A6",
  hospital_supervisor: "#14B8A6",
  hospital_staff: "#14B8A6",
  hospital_coord: "#14B8A6",
  hospitaladmin: "#0D9488",
  hospitalstaff: "#0D9488",
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
