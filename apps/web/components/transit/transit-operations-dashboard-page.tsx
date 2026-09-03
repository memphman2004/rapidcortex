import { redirect } from "next/navigation";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { extractTransitCode } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { TransitConsoleHome } from "./transit-console-home";

const TRANSIT_CONSOLE_ROLES = new Set([
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
  "TRANSIT_OPERATOR",
]);

export async function TransitOperationsDashboardPage({
  agencyId: agencyIdProp,
  transitName,
}: {
  agencyId?: string;
  transitName?: string;
} = {}) {
  if (!isVerticalEnabled("transit")) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/transit");
  }

  const agencyId = agencyIdProp?.trim() || user.agencyId;
  const roleVertical = verticalFromRole(user.role);
  const roleToken = user.role.trim().toUpperCase();
  if (roleVertical !== "transit" && !TRANSIT_CONSOLE_ROLES.has(roleToken)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const transitCode = extractTransitCode(agencyId);
  return (
    <TransitConsoleHome
      agencyId={agencyId}
      transitCode={transitCode}
      transitName={transitName ?? "Hoover Valley Transit"}
      userEmail={user.email ?? ""}
      userRole={user.role}
      userId={user.userId}
    />
  );
}
