import { redirect } from "next/navigation";
import { canAccessSalesAutomation, canManageSalesAutomation } from "rapid-cortex-shared";
import { SalesAutomationClient } from "@/components/rapid-iq/sales-automation-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Email Campaigns",
  robots: { index: false, follow: false },
};

export default async function RcAdminSalesAutomationPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesAutomation(user.role) || !isSalesAutomationUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/sales-automation`);
  }

  const canManage = canManageSalesAutomation(user.role);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Email Campaigns</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {canManage
            ? "Draft, edit, and schedule outbound campaign email to 911, campus, and venue prospects. Send up to 100 addresses in one approval. Set a send time on any email; unsent copy stays editable until it goes out."
            : "View the campaign queue and queue new drafts for RC admin approval. Sales contractors cannot approve campaigns or edit campaign copy."}
        </p>
      </div>
      <SalesAutomationClient canManage={canManage} />
    </div>
  );
}
