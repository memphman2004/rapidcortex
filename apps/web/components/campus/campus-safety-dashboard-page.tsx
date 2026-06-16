import { redirect } from "next/navigation";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { extractCampusCode } from "@/lib/auth/post-login-redirect";
import { resolveCampusDisplayName } from "@/lib/campus/campus-admin-page";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { CampusSafetyDashboard } from "./campus-safety-dashboard";

const CAMPUS_CONSOLE_ROLES = new Set([
  "CAMPUS_SECURITY",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_DISPATCH",
  "CAMPUS_FACULTY",
  "CAMPUS_COUNSELOR",
]);

/** Server entry for the campus safety console — not the 911 dispatcher CAD workspace. */
export async function CampusSafetyDashboardPage() {
  if (!isVerticalEnabled("campus")) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/campus");
  }

  if (verticalFromRole(user.role) !== "campus") {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const roleToken = user.role.trim().toUpperCase();
  if (!CAMPUS_CONSOLE_ROLES.has(roleToken)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const campusCode = extractCampusCode(user.agencyId);
  const agencyName = await resolveCampusDisplayName(campusCode);

  return (
    <CampusSafetyDashboard
      agencyName={agencyName}
      agencySlug={campusCode}
      userEmail={user.email ?? ""}
      userRole={user.role}
    />
  );
}
