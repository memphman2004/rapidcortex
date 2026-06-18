import { redirect } from "next/navigation";
import type { AgencyProfileResponse } from "rapid-cortex-shared";
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
  "CAMPUS_ADMIN",
]);

/** Server entry for the campus safety console — not the 911 dispatcher CAD workspace. */
export async function CampusSafetyDashboardPage({
  agencyId: agencyIdProp,
  profile,
}: {
  agencyId?: string;
  profile?: AgencyProfileResponse | null;
} = {}) {
  if (!isVerticalEnabled("campus")) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=${agencyIdProp ? `/${encodeURIComponent(agencyIdProp)}` : "/app/campus"}`);
  }

  const agencyId = agencyIdProp?.trim() || user.agencyId;
  const roleVertical = verticalFromRole(user.role);
  if (roleVertical !== "campus" && user.agencyId.trim() !== agencyId.trim()) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const roleToken = user.role.trim().toUpperCase();
  if (!CAMPUS_CONSOLE_ROLES.has(roleToken) && roleVertical !== "campus") {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const campusCode = extractCampusCode(agencyId);
  const agencyName = profile?.name ?? (await resolveCampusDisplayName(campusCode));

  return (
    <CampusSafetyDashboard
      agencyId={agencyId}
      agencyName={agencyName}
      agencySlug={campusCode}
      linkBase={`/${agencyId}`}
      userEmail={user.email ?? ""}
      userRole={user.role}
    />
  );
}
