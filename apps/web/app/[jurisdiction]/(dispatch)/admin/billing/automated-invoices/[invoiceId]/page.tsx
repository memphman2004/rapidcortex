import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isAutomatedInvoicesEnabled } from "@/lib/runtime-flags";
import { AgencyAutomatedInvoiceDetailClient } from "./invoice-detail-client";

type Props = { params: Promise<{ jurisdiction: string; invoiceId: string }> };

export default async function AgencyAutomatedInvoiceDetailPage({ params }: Props) {
  const { jurisdiction, invoiceId } = await params;
  if (!isAutomatedInvoicesEnabled()) redirect(`/${jurisdiction}/admin/billing`);
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (user.role !== "agencyadmin") redirect(`/${jurisdiction}/admin/billing`);
  return <AgencyAutomatedInvoiceDetailClient invoiceId={decodeURIComponent(invoiceId)} />;
}
