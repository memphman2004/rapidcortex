import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertTemplatesClient } from "@/components/alerts/vertical-alert-templates-client";

export default async function CampusAlertTemplatesPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/campus/${campusCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "CAMPUS_SECURITY", user?.agencyId ?? "");
  if (!access.canManageTemplates && !access.canViewHistory) {
    redirect(`/app/campus/${campusCode}/alerts`);
  }
  return <VerticalAlertTemplatesClient vertical="campus" />;
}
