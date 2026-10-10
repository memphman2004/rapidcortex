import { redirect } from "next/navigation";
import { isCampusAdminRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isCampusCleryEnabled } from "@/lib/runtime-flags";
import { CampusCleryWorkspace } from "@/components/campus/campus-clery-workspace";

export default async function CampusCleryPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isCampusCleryEnabled()) {
    redirect(`/app/campus/${campusCode}/reports`);
  }

  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("clery", role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  const canManage =
    isRcInternalOperator(role) || isCampusAdminRole(role) || role === "agencyadmin";

  return <CampusCleryWorkspace campusCode={campusCode} canManage={canManage} />;
}
