import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertTemplatesClient } from "@/components/alerts/vertical-alert-templates-client";

export default async function VenueAlertTemplatesPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/venue/${venueCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "VENUE_SECURITY", user?.agencyId ?? "");
  if (!access.canManageTemplates && !access.canViewHistory) {
    redirect(`/app/venue/${venueCode}/alerts`);
  }
  return <VerticalAlertTemplatesClient vertical="venue" />;
}
