import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = { title: "Platform add-ons", robots: { index: false, follow: false } };

export default async function RcAdminAddOnsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role))
    redirect(`${marketingLoginPath()}?from=/rc-admin/add-ons`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Add-ons</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Feature add-ons (CAD, AI, API access, premium support, onsite, setup fee) are billed separately from base plans.
        Entitlements resolve in <code className="text-xs text-sky-200">resolveFeatureEntitlements</code> — keep procurement
        catalog SKUs aligned to <code className="text-xs text-sky-200">MonetizationAddOnId</code>.
      </p>
      <Link href="/rc-admin/billing" className="text-sm text-sky-400 hover:text-sky-300">
        ← Billing hub
      </Link>
    </div>
  );
}
