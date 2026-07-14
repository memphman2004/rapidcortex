import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { RcAdminLeadsClient } from "@/components/rc-admin/leads-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

export default async function RcAdminLeadsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isSalesLeadsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/leads`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Leads</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Contact Sales and Ring Connect waitlist submissions. Update pipeline status and notes as
          you work the inbox.
        </p>
      </div>
      <RcAdminLeadsClient />
    </div>
  );
}
