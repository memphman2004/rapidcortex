import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = { title: "Platform invoices", robots: { index: false, follow: false } };

export default async function RcAdminInvoicesPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role))
    redirect(`${marketingLoginPath()}?from=/rc-admin/invoices`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Invoices & PO</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Government customers: track purchase order numbers, Net 30 / Net 45 terms, and manual paid status in monetization
        invoice records; finance operations issue PDFs when enabled. Never trust client-supplied external invoice IDs
        without server validation.
      </p>
      <Link href="/rc-admin/billing" className="text-sm text-sky-400 hover:text-sky-300">
        ← Billing hub
      </Link>
    </div>
  );
}
