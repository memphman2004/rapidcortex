import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ServiceCatalogDashboard } from "@/components/billing/service-catalog-dashboard";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = {
  title: "Billing Service Catalog",
  robots: { index: false, follow: false },
};

export default async function RcAdminBillingServicesPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/billing/services`);
  }

  return <ServiceCatalogDashboard />;
}
