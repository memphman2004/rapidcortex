import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertsDispatchClient } from "@/components/alerts/vertical-alerts-dispatch-client";

export default async function TransitAlertsPage({
  params,
}: {
  params: Promise<{ transitCode: string }>;
}) {
  const { transitCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/transit/${transitCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "TRANSIT_SECURITY", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect(`/transit/${transitCode}`);
  return (
    <VerticalAlertsDispatchClient
      vertical="transit"
      basePath={`/transit/${transitCode}/alerts`}
      displayName={transitCode.toUpperCase()}
      canDispatch={access.canDispatch}
      canDispatchCritical={access.canDispatchCritical}
      canManageRecipients={access.canManageRecipients}
      canManageTemplates={access.canManageTemplates}
    />
  );
}
