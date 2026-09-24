import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isAutomatedInvoicesEnabled } from "@/lib/runtime-flags";
import { AutomatedBillingDashboardClient } from "./billing-dashboard-client";

export const metadata = { title: "Automated invoices — NexCort iQ Admin", robots: { index: false, follow: false } };

export default async function AutomatedInvoicesPage() {
  if (!isAutomatedInvoicesEnabled()) redirect("/rc-admin/billing");
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/automated-invoices`);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">NexCort Internal</p>
        <h1 className="mt-0.5 text-2xl font-semibold text-white">Automated invoices</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Monthly last-day invoices from plan, seats, add-ons, and usage. Drafts stay unsent until you approve them.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-400">Loading invoices…</p>}>
        <AutomatedBillingDashboardClient />
      </Suspense>
    </div>
  );
}
