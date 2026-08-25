import { redirect } from "next/navigation";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { RcAdminGrantsTabsClient } from "@/components/rc-admin/grants-tabs-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isGrantSuccessProgramUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Grants",
  robots: { index: false, follow: false },
};

/** Platform access grants + Grant Success Program — rcsuperadmin and rcadmin only (rcitadmin excluded). */
export default async function RcAdminGrantsPage() {
  const user = await getDashboardSessionUser();
  if (!user || (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role))) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/grants`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Grants</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Issue access overrides, review active grants, and generate Rapid Cortex procurement grant packages.
        </p>
      </div>
      <RcAdminGrantsTabsClient initialUser={user} showGrantSuccessProgram={isGrantSuccessProgramUiEnabled()} />
    </div>
  );
}
