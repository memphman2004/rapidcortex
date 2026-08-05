import { redirect } from "next/navigation";
import { canAccessRcFinancePortal, isRcInternalOperator } from "rapid-cortex-shared";
import { DeploymentsMapPanel } from "@/components/rc-admin/deployments-map-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isDeploymentsMapEnabled, isPsapProspectsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Deployments map",
  robots: { index: false, follow: false },
};

export default async function RcAdminDeploymentsMapPage() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role) || !isDeploymentsMapEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/deployments-map`);
  }

  const showPsapProspectsLayer =
    canAccessRcFinancePortal(user.role) && isPsapProspectsUiEnabled();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Deployments map</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          National HQ pins across agencies. Fill agency latitude/longitude on create or the agency
          profile so tenants appear here. Pin color is the product vertical; hover for a preview,
          click for the detail column. Sort the customer list by vertical, name, status, or state.
        </p>
      </div>
      <DeploymentsMapPanel showPsapProspectsLayer={showPsapProspectsLayer} />
    </div>
  );
}
