import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { StaffGuideView } from "@/components/staff-guide/staff-guide-view";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isStaffGuideEnabled } from "@/lib/runtime-flags";
import { resolveStaffGuideHref } from "@/lib/staff-guide/href";
import { staffGuideVerticalFromRole } from "@/lib/staff-guide/catalog";

/** Fallback knowledge-base URL when the console path has no campus/venue/transit code. */
export default async function StaffGuideFallbackPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login?from=/staff-guide");
  if (!isStaffGuideEnabled()) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const vertical = staffGuideVerticalFromRole(user.role);
  if (!vertical) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const scoped = resolveStaffGuideHref({ role: user.role, agencyId: user.agencyId });
  if (scoped && scoped !== "/staff-guide") {
    redirect(scoped);
  }

  return <StaffGuideView vertical={vertical} role={user.role} basePath="/staff-guide" />;
}
