import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isEnsTestProgramEnabled, isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalEnsTestProgramClient } from "@/components/alerts/vertical-ens-test-program-client";

export default async function VenueEnsTestsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  if (!isVerticalAlertsEnabled() || !isEnsTestProgramEnabled()) redirect(`/venue/${venueCode}/alerts`);
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "VENUE_SECURITY";
  const access = verticalAlertAccess(role, user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canManageEns && !access.canRunEns) {
    redirect(`/venue/${venueCode}`);
  }
  return (
    <VerticalEnsTestProgramClient
      vertical="venue"
      basePath={`/venue/${venueCode}/alerts`}
      displayName={venueCode.toUpperCase()}
      canManage={access.canManageEns}
      canRun={access.canRunEns}
    />
  );
}
