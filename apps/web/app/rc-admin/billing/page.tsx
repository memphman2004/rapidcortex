import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = {
  title: "Platform billing controls",
  robots: { index: false, follow: false },
};

export default async function RcAdminBillingPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/billing`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Monetization & billing</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Configure plans/add-ons directly in Dynamo, reconcile internal billing webhooks and usage meters, or apply manual
          entitlements—all actions emit billing audit envelopes for oversight.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-slate-500">
          Keep <strong className="text-slate-300">Rapid Cortex platform</strong> (dispatcher/supervisor dashboards) rows
          distinct from <strong className="text-slate-300">RC Lite</strong> API-only rows: each plan record exposes{" "}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-sky-200">productLine</code>, dashboard vs API
          flags, and entitlement templates so Cognito claims and middleware stay aligned.
        </p>
      </div>
      <ul className="space-y-3 text-sm text-slate-300">
        <li>
          <strong className="text-white">Retired processor proxies</strong> — legacy HTTPS paths under{" "}
          <code className="rounded bg-slate-900 px-2 py-0.5 text-xs text-sky-200">/api/billing/…</code> that formerly
          proxied external card processors now return{" "}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-sky-200">410 Gone</code> with{" "}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-sky-200">payments_disabled</code>. Agency access is
          contract, pilot, and invoice driven.
        </li>
        <li>
          <strong className="text-white">Tenant billing reads</strong> —{" "}
          <code className="rounded bg-slate-900 px-2 py-0.5 text-xs text-sky-200">GET /api/billing/current-subscription</code>,{" "}
          invoices, and usage reporting (no card capture on these routes).
        </li>
        <li>
          <strong className="text-white">Data plane</strong> — Tables: monetization-plans, monetization-addons,
          agency-subscriptions, usage-meters, monetization-invoices, billing-audit-events, sales-leads.
        </li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/rc-admin/plans"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950"
        >
          Plans
        </Link>
        <Link
          href="/rc-admin/add-ons"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950"
        >
          Add-ons
        </Link>
        <Link
          href="/rc-admin/billing/services"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950"
        >
          Service Catalog
        </Link>
        <Link
          href="/rc-admin/invoices"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950"
        >
          Invoices
        </Link>
        <Link
          href="/rc-admin/usage"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950"
        >
          Usage
        </Link>
        <Link
          href="/rc-admin/api-clients"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950"
        >
          API clients →
        </Link>
      </div>
    </div>
  );
}
