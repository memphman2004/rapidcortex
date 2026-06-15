import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { RcAdminAgreementsClient } from "@/components/rc-admin/agreements-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Agreements",
  robots: { index: false, follow: false },
};

export default async function RcAdminAgreementsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/agreements`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Agreements</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Track MSA, pilot scope, and RC Lite API agreements. Adobe Sign completions auto-provision
          RC Lite tenants; platform MSAs notify RC ops for manual onboarding.
        </p>
      </div>
      <RcAdminAgreementsClient />
    </div>
  );
}
