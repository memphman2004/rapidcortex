import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isEnsTestProgramEnabled, isVerticalAlertsEnabled } from "@/lib/runtime-flags";
import { verticalAlertAccess } from "@/lib/alerts/vertical-alert-access";
import { VerticalEnsTestProgramClient } from "@/components/alerts/vertical-ens-test-program-client";

export default async function CampusEnsTestsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isVerticalAlertsEnabled() || !isEnsTestProgramEnabled()) redirect(`/app/campus/${campusCode}/alerts`);
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  const access = verticalAlertAccess(role, user?.agencyId ?? "");
  if (!access.canViewHistory && !access.canManageEns && !access.canRunEns) {
    redirect(`/app/campus/${campusCode}`);
  }
  return (
    <VerticalEnsTestProgramClient
      vertical="campus"
      basePath={`/app/campus/${campusCode}/alerts`}
      displayName={campusCode.toUpperCase()}
      canManage={access.canManageEns}
      canRun={access.canRunEns}
    />
  );
}
