import { redirect } from "next/navigation";
import { canAccessSalesAutomation, canManageSalesAutomation } from "rapid-cortex-shared";
import { EmailListClient } from "@/components/rapid-iq/email-list-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Email List",
  robots: { index: false, follow: false },
};

export default async function RcAdminEmailListPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesAutomation(user.role) || !isSalesAutomationUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/email-list`);
  }

  const canRemove = canManageSalesAutomation(user.role);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Email List</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Monthly Inside iQ subscribers by product vertical. Add addresses here or via{" "}
          <span className="text-slate-300">Subscribe to monthly email</span> on PSAP Prospects.
          Export CSV for campaigns; unsubscribes are honored automatically.
        </p>
      </div>
      <EmailListClient canRemove={canRemove} />
    </div>
  );
}
