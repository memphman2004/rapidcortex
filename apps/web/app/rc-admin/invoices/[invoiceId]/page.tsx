import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { RcAdminInvoiceDetailClient } from "@/components/billing/rc-admin-invoice-detail-client";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = { title: "Invoice detail", robots: { index: false, follow: false } };

type Props = { params: Promise<{ invoiceId: string }> };

export default async function RcAdminInvoiceDetailPage({ params }: Props) {
  const { invoiceId } = await params;
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/invoices/${encodeURIComponent(invoiceId)}`);
  }

  return <RcAdminInvoiceDetailClient invoiceId={invoiceId} />;
}
