import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertsDispatchClient } from "@/components/alerts/vertical-alerts-dispatch-client";

export default async function VenueAlertsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/venue/${venueCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "VENUE_SECURITY", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect(`/app/venue/${venueCode}`);
  return (
    <VerticalAlertsDispatchClient
      vertical="venue"
      basePath={`/app/venue/${venueCode}/alerts`}
      displayName={venueCode.toUpperCase()}
      canDispatch={access.canDispatch}
      canDispatchCritical={access.canDispatchCritical}
      canManageRecipients={access.canManageRecipients}
      canManageTemplates={access.canManageTemplates}
    />
  );
}
