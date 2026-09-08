import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertTemplatesClient } from "@/components/alerts/vertical-alert-templates-client";

export default async function TransitAlertTemplatesPage({
  params,
}: {
  params: Promise<{ transitCode: string }>;
}) {
  const { transitCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/transit/${transitCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "TRANSIT_SECURITY", user?.agencyId ?? "");
  if (!access.canManageTemplates && !access.canViewHistory) {
    redirect(`/transit/${transitCode}/alerts`);
  }
  return <VerticalAlertTemplatesClient vertical="transit" />;
}
