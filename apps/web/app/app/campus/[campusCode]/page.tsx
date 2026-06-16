import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { CampusDashboardHome } from "@/components/dashboards/DashboardHomeRenderer";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

const OPERATIONAL_ROLES = new Set(["CAMPUS_SECURITY", "CAMPUS_SUPERVISOR", "CAMPUS_DISPATCH"]);

export default async function CampusHomePage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const normalizedCode = campusCode.toUpperCase();
  const user = await getDashboardSessionUser();
  if (!user) return null;

  const role = user.role?.trim().toUpperCase() ?? "";
  if (OPERATIONAL_ROLES.has(role)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  return (
    <CampusDashboardHome
      campusCode={normalizedCode}
      role={user.role}
      agencyId={user.agencyId}
      displayName={dashboardDisplayName(user)}
    />
  );
}
