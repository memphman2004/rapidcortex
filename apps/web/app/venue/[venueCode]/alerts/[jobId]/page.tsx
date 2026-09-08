import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertJobClient } from "@/components/alerts/vertical-alert-job-client";

export default async function VenueAlertJobPage({
  params,
}: {
  params: Promise<{ venueCode: string; jobId: string }>;
}) {
  const { venueCode, jobId } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/venue/${venueCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "VENUE_SECURITY", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect(`/app/venue/${venueCode}`);
  return <VerticalAlertJobClient jobId={jobId} />;
}
