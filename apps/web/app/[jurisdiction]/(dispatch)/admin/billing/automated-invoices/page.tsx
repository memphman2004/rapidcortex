import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isAutomatedInvoicesEnabled } from "@/lib/runtime-flags";
import { AgencyAutomatedBillingClient } from "./billing-page-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AgencyAutomatedInvoicesPage({ params }: Props) {
  const { jurisdiction } = await params;
  if (!isAutomatedInvoicesEnabled()) redirect(`/${jurisdiction}/admin/billing`);
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (user.role !== "agencyadmin") redirect(`/${jurisdiction}/admin/billing`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Monthly invoices</h1>
        <p className="mt-2 text-sm text-slate-400">Your agency invoices only. Payment terms are NET 30 from the invoice date.</p>
      </div>
      <AgencyAutomatedBillingClient jurisdiction={jurisdiction} />
    </div>
  );
}
