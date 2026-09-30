import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { CampusConsoleHome } from "@/components/campus/campus-console-home";
import { resolveCampusDisplayName } from "@/lib/campus/campus-admin-page";
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

  const agencyName = await resolveCampusDisplayName(normalizedCode);

  return (
    <CampusConsoleHome
      agencyId={user.agencyId}
      campusCode={normalizedCode}
      agencyName={agencyName}
      displayName={dashboardDisplayName(user)}
      userEmail={user.email ?? ""}
      userRole={user.role}
      userId={user.userId}
    />
  );
}
