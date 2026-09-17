import { redirect } from "next/navigation";
import { canAccessRapidIq } from "rapid-cortex-shared";
import { SalesAutomationClient } from "@/components/rapid-iq/sales-automation-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Sales Automation",
  robots: { index: false, follow: false },
};

export default async function RcAdminSalesAutomationPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIq(user.role) || !isSalesAutomationUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/sales-automation`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Sales Automation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Outbound campaign emails to potential 911, campus, and venue clients. Connect
          hello@rapidcortex.us, then approve. Email 1 sends from that mailbox; follow-ups go on days
          5 and 12. Use Bulk campaign for 100–500 prospects in one approval.
        </p>
      </div>
      <SalesAutomationClient />
    </div>
  );
}
