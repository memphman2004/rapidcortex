import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertsDispatchClient } from "@/components/alerts/vertical-alerts-dispatch-client";

export default async function CampusAlertsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/campus/${campusCode}`);
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  const access = verticalAlertAccess(role, user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect(`/app/campus/${campusCode}`);
  return (
    <VerticalAlertsDispatchClient
      vertical="campus"
      basePath={`/app/campus/${campusCode}/alerts`}
      displayName={campusCode.toUpperCase()}
      canDispatch={access.canDispatch}
      canDispatchCritical={access.canDispatchCritical}
      canManageRecipients={access.canManageRecipients}
      canManageTemplates={access.canManageTemplates}
    />
  );
}
