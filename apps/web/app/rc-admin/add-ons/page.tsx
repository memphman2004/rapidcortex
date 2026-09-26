import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal, defaultAddOnSeed } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = { title: "Platform add-ons", robots: { index: false, follow: false } };

export default async function RcAdminAddOnsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role))
    redirect(`${marketingLoginPath()}?from=/rc-admin/add-ons`);

  const addOns = Object.values(defaultAddOnSeed(new Date().toISOString()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Add-ons</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Monetization add-on SKUs (<code className="text-xs text-sky-200">MonetizationAddOnId</code>
          ). Billable catalog line items also live in{" "}
          <Link href="/rc-admin/billing/services" className="text-sky-400 hover:text-sky-300">
            Service Catalog
          </Link>
          .
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {addOns.map((row) => (
              <tr key={row.addOnId}>
                <td className="px-4 py-3 font-mono text-xs text-violet-300">{row.addOnId}</td>
                <td className="px-4 py-3 text-slate-100">{row.addOnName}</td>
                <td className="px-4 py-3 text-slate-400">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link href="/rc-admin/billing" className="text-sm text-sky-400 hover:text-sky-300">
        ← Billing hub
      </Link>
    </div>
  );
}
