import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertJobClient } from "@/components/alerts/vertical-alert-job-client";

export default async function TransitAlertJobPage({
  params,
}: {
  params: Promise<{ transitCode: string; jobId: string }>;
}) {
  const { transitCode, jobId } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/transit/${transitCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "TRANSIT_SECURITY", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect(`/transit/${transitCode}`);
  return <VerticalAlertJobClient jobId={jobId} />;
}
