import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { RcAdminInvoicesClient } from "@/components/billing/rc-admin-invoices-client";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = { title: "Platform invoices", robots: { index: false, follow: false } };

export default async function RcAdminInvoicesPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/invoices`);
  }

  return <RcAdminInvoicesClient />;
}
