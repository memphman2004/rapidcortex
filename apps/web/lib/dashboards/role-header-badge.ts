import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

/** Header badge adjacent to username — makes signed-in role obvious per dashboard spec. */
export function getRoleHeaderBadgeLabel(role: string | undefined | null): string | null {
  const effective = migrateLegacyRapidCortexRoleTokenValue(role?.trim() ?? "") ?? role?.trim();
  if (!effective) return null;

  switch (effective) {
    case "rcsuperadmin":
      return "PLATFORM — SUPERADMIN";
    case "rcadmin":
      return "PLATFORM — ADMIN";
    case "rcitadmin":
      return "PLATFORM — IT";
    case "dispatcher":
      return "SYSTEM NOMINAL";
    case "supervisor":
      return "SUPERVISOR";
    case "agencyadmin":
      return "ADMIN";
    case "agencyit":
      return "IT ADMIN";
    case "analyst":
      return "QA ANALYST";
    case "auditor":
      return "AUDITOR";
    case "hospitaladmin":
      return "HOSPITAL ADMIN";
    case "hospitalstaff":
      return "STAFF";
    case "VENUE_ADMIN":
      return "VENUE ADMIN";
    case "VENUE_SUPERVISOR":
      return "SUPERVISOR";
    case "VENUE_SECURITY":
      return "SECURITY";
    case "VENUE_OPERATOR":
      return "OPERATOR";
    case "VENUE_GUEST_SERVICES":
      return "GUEST SERVICES";
    case "CAMPUS_ADMIN":
      return "CAMPUS ADMIN";
    case "CAMPUS_SUPERVISOR":
      return "SUPERVISOR";
    case "CAMPUS_SECURITY":
      return "SECURITY";
    case "CAMPUS_DISPATCH":
      return "DISPATCH";
    default:
      return null;
  }
}
