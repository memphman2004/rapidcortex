import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isAutomatedInvoicesEnabled } from "@/lib/runtime-flags";
import { AutomatedInvoiceDetailClient } from "../invoice-detail-client";

export const metadata = { title: "Automated invoice — Rapid Cortex Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ invoiceId: string }> };

export default async function AutomatedInvoiceDetailPage({ params }: Props) {
  if (!isAutomatedInvoicesEnabled()) redirect("/rc-admin/billing");
  const { invoiceId } = await params;
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/automated-invoices`);
  }
  return <AutomatedInvoiceDetailClient invoiceId={decodeURIComponent(invoiceId)} />;
}
