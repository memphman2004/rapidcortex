import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertJobClient } from "@/components/alerts/vertical-alert-job-client";

export default async function CampusAlertJobPage({
  params,
}: {
  params: Promise<{ campusCode: string; jobId: string }>;
}) {
  const { campusCode, jobId } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/campus/${campusCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "CAMPUS_SECURITY", user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canDispatch) redirect(`/app/campus/${campusCode}`);
  return <VerticalAlertJobClient jobId={jobId} />;
}
