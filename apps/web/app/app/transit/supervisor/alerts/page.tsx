import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertsDispatchClient } from "@/components/alerts/vertical-alerts-dispatch-client";

export default async function AppTransitSupervisorAlertsPage() {
  if (!isVerticalAlertsEnabled()) redirect("/app/transit/supervisor");
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "TRANSIT_SUPERVISOR", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect("/app/transit/supervisor");
  return (
    <VerticalAlertsDispatchClient
      vertical="transit"
      basePath={`/app/transit/supervisor/alerts`}
      displayName="Transit"
      canDispatch={access.canDispatch}
      canDispatchCritical={access.canDispatchCritical}
      canManageRecipients={access.canManageRecipients}
      canManageTemplates={access.canManageTemplates}
    />
  );
}
