import { redirect } from "next/navigation";
import {
  canAccessRcFinancePortal,
  canAccessRcRevenuePortal,
} from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { serverPricingJson } from "@/lib/server/server-pricing-fetch";
import type { GlobalPricingConfig, TenantPricingSummary } from "@/lib/pricing/pricing-types";
import { PricingDashboardClient } from "./pricing-dashboard-client";

export const metadata = {
  title: "Pricing Menu",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PricingAdminPage() {
  const user = await getDashboardSessionUser();
  // rcadmin + rcsuperadmin (+ rcitadmin via finance portal) may view; only superadmin edits.
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect("/unauthorized");
  }

  const canEdit = canAccessRcRevenuePortal(user.role);

  const [initialGlobal, initialTenantsRes] = await Promise.all([
    serverPricingJson<GlobalPricingConfig & { pricing: Record<string, number> }>(
      "/api/admin/pricing/global",
    ),
    serverPricingJson<{ tenants: TenantPricingSummary[] }>("/api/admin/pricing/tenants"),
  ]);

  const initialGlobalSafe: GlobalPricingConfig = initialGlobal ?? {
    pk: "GLOBAL",
    sk: "v1",
    overrides: {},
    version: 0,
    lastModifiedBy: "",
    lastModifiedAt: "",
  };

  return (
    <PricingDashboardClient
      initialGlobal={initialGlobalSafe}
      initialTenants={initialTenantsRes?.tenants ?? []}
      canEdit={canEdit}
    />
  );
}
