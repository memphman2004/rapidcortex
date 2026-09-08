import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertRecipientsClient } from "@/components/alerts/vertical-alert-recipients-client";

export default async function VenueAlertRecipientsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/venue/${venueCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "VENUE_SECURITY", user?.agencyId ?? "");
  if (!access.canManageRecipients) redirect(`/app/venue/${venueCode}/alerts`);
  return <VerticalAlertRecipientsClient vertical="venue" />;
}
