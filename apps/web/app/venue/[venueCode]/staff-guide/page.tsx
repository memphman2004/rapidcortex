import { redirect } from "next/navigation";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { StaffGuideView } from "@/components/staff-guide/staff-guide-view";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isStaffGuideEnabled } from "@/lib/runtime-flags";

export default async function VenueStaffGuidePage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  const code = venueCode.toUpperCase();
  if (!isStaffGuideEnabled()) redirect(`/app/venue/${code}`);

  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/venue/${encodeURIComponent(code)}/staff-guide`);

  const roleVertical = verticalFromRole(user.role);
  if (roleVertical !== "venue" && !isRcInternalOperator(user.role)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  return <StaffGuideView vertical="venue" role={user.role} basePath={`/app/venue/${code}/staff-guide`} />;
}
