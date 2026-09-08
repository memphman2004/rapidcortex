import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertRecipientsClient } from "@/components/alerts/vertical-alert-recipients-client";

export default async function CampusAlertRecipientsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/app/campus/${campusCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "CAMPUS_SECURITY", user?.agencyId ?? "");
  if (!access.canManageRecipients) redirect(`/app/campus/${campusCode}/alerts`);
  return <VerticalAlertRecipientsClient vertical="campus" />;
}
