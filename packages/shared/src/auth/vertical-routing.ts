import type { UserRole } from "../types.js";
import { migrateLegacyRapidCortexRoleTokenValue } from "./rapid-cortex-roles.js";

export type RCVertical = "platform" | "911" | "campus" | "venue" | "hospital" | "transit";

function effectiveRole(role: UserRole | string): string {
  return (migrateLegacyRapidCortexRoleTokenValue(String(role).trim()) ?? String(role).trim()).toLowerCase();
}

export function verticalFromRole(role: UserRole | string): RCVertical {
  const r = effectiveRole(role);
  if (r.startsWith("rc")) return "platform";
  if (r.startsWith("campus_")) return "campus";
  if (r.startsWith("venue_")) return "venue";
  if (r.startsWith("hospital_") || r === "hospitaladmin" || r === "hospitalstaff") return "hospital";
  if (r.startsWith("transit_")) return "transit";
  return "911";
}

export function dashboardRouteFromRole(role: UserRole | string, agencyId: string): string {
  const r = effectiveRole(role);
  const jurisdiction = agencyId.split("-")[0]?.trim() || "rc";

  switch (r) {
    case "rcsuperadmin":
    case "rcadmin":
    case "rcitadmin":
      return "/rc-admin";
    case "agencyadmin":
      return `/${jurisdiction}/admin`;
    case "agencyit":
      return `/${jurisdiction}/it`;
    case "supervisor":
      return `/${jurisdiction}/supervisor`;
    case "dispatcher":
      return `/${jurisdiction}/dispatcher`;
    case "analyst":
      return `/${jurisdiction}/analytics`;
    case "auditor":
      return `/${jurisdiction}/audit`;
    case "campus_admin":
      return "/app/campus/admin";
    case "campus_supervisor":
      return "/app/campus/supervisor";
    case "campus_security":
      return "/app/campus/security";
    case "campus_counselor":
      return "/app/campus/counselor";
    case "campus_faculty":
      return "/app/campus/faculty";
    case "venue_admin":
      return "/app/venue/admin";
    case "venue_supervisor":
      return "/app/venue/supervisor";
    case "venue_security":
      return "/app/venue/security";
    case "venue_operator":
      return "/app/venue/operator";
    case "venue_guest":
      return "/app/venue/guest";
    case "hospital_admin":
    case "hospitaladmin":
      return "/app/hospital/admin";
    case "hospital_supervisor":
      return "/app/hospital/supervisor";
    case "hospital_staff":
    case "hospitalstaff":
      return "/app/hospital/staff";
    case "hospital_coord":
      return "/app/hospital/coordinator";
    case "transit_admin":
      return "/app/transit/admin";
    case "transit_supervisor":
      return "/app/transit/supervisor";
    case "transit_security":
      return "/app/transit/security";
    case "transit_operator":
      return "/app/transit/operator";
    default:
      return "/app/dashboard";
  }
}

/** True when `pathname` is within the role's allowed dashboard shell (no cross-vertical bleed). */
export function pathMatchesRoleDashboard(
  pathname: string,
  role: UserRole | string,
  agencyId: string,
): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  const vertical = verticalFromRole(role);
  const home = dashboardRouteFromRole(role, agencyId);

  if (vertical === "platform") {
    return path === "/rc-admin" || path.startsWith("/rc-admin/");
  }

  if (vertical === "911") {
    const jurisdiction = agencyId.split("-")[0]?.trim() || "rc";
    const jurPrefix = `/${jurisdiction}/`;
    if (!path.startsWith(jurPrefix)) return false;
    return path === home || path.startsWith(`${home}/`);
  }

  if (vertical === "campus") {
    if (!path.startsWith("/app/campus/")) return false;
    const segment = path.split("/")[3] ?? "";
    const roleSegments = new Set(["admin", "supervisor", "security", "counselor", "faculty"]);
    if (roleSegments.has(segment)) {
      return path === home || path.startsWith(`${home}/`);
    }
    return true;
  }
  if (vertical === "venue") {
    if (path.startsWith("/venue/")) return true;
    if (!path.startsWith("/app/venue/")) return false;
    const segment = path.split("/")[3] ?? "";
    const roleSegments = new Set(["admin", "supervisor", "security", "operator", "guest"]);
    if (roleSegments.has(segment)) {
      return path === home || path.startsWith(`${home}/`);
    }
    return true;
  }
  if (vertical === "hospital") {
    if (path.startsWith("/hospital-admin/") || path.startsWith("/hospital-staff/")) return true;
    if (!path.startsWith("/app/hospital/")) return false;
    const segment = path.split("/")[3] ?? "";
    const roleSegments = new Set(["admin", "supervisor", "staff", "coordinator"]);
    if (roleSegments.has(segment)) {
      return path === home || path.startsWith(`${home}/`);
    }
    return true;
  }
  if (vertical === "transit") {
    if (!path.startsWith("/app/transit/")) return false;
    const segment = path.split("/")[3] ?? "";
    const roleSegments = new Set(["admin", "supervisor", "security", "operator"]);
    if (roleSegments.has(segment)) {
      return path === home || path.startsWith(`${home}/`);
    }
    return true;
  }

  return path === home || path.startsWith(`${home}/`);
}
