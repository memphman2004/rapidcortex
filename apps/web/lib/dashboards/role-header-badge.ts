import {
  campusMatrixRoleFromRole,
  campusProductFromRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";

/** Header badge adjacent to username — makes signed-in role obvious per dashboard spec. */
export function getRoleHeaderBadgeLabel(role: string | undefined | null): string | null {
  const effective = migrateLegacyRapidCortexRoleTokenValue(role?.trim() ?? "") ?? role?.trim();
  if (!effective) return null;

  const campusFamily = campusMatrixRoleFromRole(effective);
  if (campusFamily) {
    const product = campusProductFromRole(effective);
    const productTag = product === "higher_ed" ? "HIGHER-ED" : "K-12";
    switch (campusFamily) {
      case "CAMPUS_ADMIN":
        return `${productTag} CAMPUS ADMIN`;
      case "CAMPUS_SUPERVISOR":
        return `${productTag} SUPERVISOR`;
      case "CAMPUS_SECURITY":
        return `${productTag} SECURITY`;
      case "CAMPUS_DISPATCH":
        return `${productTag} DISPATCH`;
      case "CAMPUS_COUNSELOR":
        return `${productTag} COUNSELOR`;
      case "CAMPUS_FACULTY":
        return `${productTag} FACULTY`;
      default:
        break;
    }
  }

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
    case "venue_admin":
    case "VENUE_ADMIN":
      return "VENUE ADMIN";
    case "venue_supervisor":
    case "VENUE_SUPERVISOR":
      return "SUPERVISOR";
    case "venue_security":
    case "VENUE_SECURITY":
      return "SECURITY";
    case "venue_operator":
    case "VENUE_OPERATOR":
      return "OPERATOR";
    case "venue_guest":
    case "VENUE_GUEST_SERVICES":
      return "GUEST SERVICES";
    case "transit_admin":
    case "TRANSIT_ADMIN":
      return "TRANSIT ADMIN";
    case "transit_supervisor":
    case "TRANSIT_SUPERVISOR":
      return "TRANSIT SUPERVISOR";
    case "transit_security":
    case "TRANSIT_SECURITY":
      return "TRANSIT SECURITY";
    case "transit_operator":
    case "TRANSIT_OPERATOR":
      return "TRANSIT OPERATOR";
    case "call_assist_admin":
    case "CALL_ASSIST_ADMIN":
      return "CALL ASSIST ADMIN";
    case "call_assist_supervisor":
    case "CALL_ASSIST_SUPERVISOR":
      return "CALL ASSIST SUPERVISOR";
    case "call_assist_operator":
    case "CALL_ASSIST_OPERATOR":
      return "CALL ASSIST";
    default:
      return null;
  }
}
