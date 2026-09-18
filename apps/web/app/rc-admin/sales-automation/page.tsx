import { redirect } from "next/navigation";
import { canAccessRapidIq } from "rapid-cortex-shared";
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
  if (!user || !canAccessRapidIq(user.role) || !isSalesAutomationUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/sales-automation`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Email Campaigns</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Draft, edit, and schedule outbound campaign email to 911, campus, and venue prospects.
          Send up to 100 addresses in one approval. Set a send time on any email; unsent copy stays
          editable until it goes out.
        </p>
      </div>
      <SalesAutomationClient />
    </div>
  );
}
