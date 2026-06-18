import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dashboardRouteFromRole, normalizeRole } from "rapid-cortex-shared/auth/vertical-routing";
import { CampusAdminDashboard } from "@/components/campus/campus-admin-dashboard";
import { extractCampusCode } from "@/lib/auth/post-login-redirect";
import { resolveCampusDisplayName } from "@/lib/campus/campus-admin-page";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata: Metadata = {
  title: "Campus Admin — Rapid Cortex",
  description: "RC Campus safety intelligence administration",
};

export default async function CampusAdminPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login");
  }

  const role = normalizeRole(user.role);
  if (role !== "campus_admin") {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const campusCode = extractCampusCode(user.agencyId);
  const agencyName = await resolveCampusDisplayName(campusCode);

  return (
    <CampusAdminDashboard
      agencyId={user.agencyId}
      campusCode={campusCode}
      agencyName={agencyName}
      adminName={dashboardDisplayName(user)}
      adminEmail={user.email}
      adminRole={user.role}
    />
  );
}
