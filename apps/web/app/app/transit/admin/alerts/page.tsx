import { redirect } from "next/navigation";
import { transitCodeFromAgencyId } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertsDispatchClient } from "@/components/alerts/vertical-alerts-dispatch-client";

export default async function AppTransitAlertsPage() {
  if (!isVerticalAlertsEnabled()) redirect("/app/transit/admin");
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "TRANSIT_SECURITY", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect("/app/transit/admin");
  const code = transitCodeFromAgencyId(user?.agencyId ?? "transit");
  return (
    <VerticalAlertsDispatchClient
      vertical="transit"
      basePath={`/app/transit/admin/alerts`}
      displayName={code}
      canDispatch={access.canDispatch}
      canDispatchCritical={access.canDispatchCritical}
      canManageRecipients={access.canManageRecipients}
      canManageTemplates={access.canManageTemplates}
    />
  );
}
