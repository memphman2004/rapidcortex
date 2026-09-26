import { redirect } from "next/navigation";
import { canAccessGrantSuccessProgram, isSalesContractorRole } from "rapid-cortex-shared";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { RcAdminGrantsTabsClient } from "@/components/rc-admin/grants-tabs-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isGrantSuccessProgramUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Grants",
  robots: { index: false, follow: false },
};

/** Access grants: rcsuperadmin/rcadmin. Grant Success Program: those roles + sales contractors. */
export default async function RcAdminGrantsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessGrantSuccessProgram(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/grants`);
  }

  const canManageAccessGrants = isRcSuperAdmin(user.role) || isRcAdmin(user.role);
  const salesOnly = isSalesContractorRole(user.role);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Grants</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {salesOnly
            ? "Generate NexCort iQ procurement grant packages for prospects."
            : "Issue access overrides, review active grants, and generate NexCort iQ procurement grant packages."}
        </p>
      </div>
      <RcAdminGrantsTabsClient
        initialUser={user}
        showGrantSuccessProgram={isGrantSuccessProgramUiEnabled()}
        hideAccessGrants={!canManageAccessGrants}
      />
    </div>
  );
}
