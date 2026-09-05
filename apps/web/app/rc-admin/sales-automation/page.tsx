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
          Rapid IQ drafts 3-touch outreach and Inside the Cortex notes. Nothing sends until you
          approve. Newsletter approval marks the draft ready — bulk list send is not wired yet.
        </p>
      </div>
      <SalesAutomationClient />
    </div>
  );
}
