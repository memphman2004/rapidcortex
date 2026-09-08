import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalAlertRecipientsClient } from "@/components/alerts/vertical-alert-recipients-client";

export default async function TransitAlertRecipientsPage({
  params,
}: {
  params: Promise<{ transitCode: string }>;
}) {
  const { transitCode } = await params;
  if (!isVerticalAlertsEnabled()) redirect(`/transit/${transitCode}`);
  const user = await getDashboardSessionUser();
  const access = verticalAlertAccess(user?.role ?? "TRANSIT_SECURITY", user?.agencyId ?? "");
  if (!access.canManageRecipients) redirect(`/transit/${transitCode}/alerts`);
  return <VerticalAlertRecipientsClient vertical="transit" />;
}
