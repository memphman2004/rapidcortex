import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { CreateInvoiceLauncher } from "@/components/billing/create-invoice-launcher";
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Monetization & billing</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Create invoices, manage the service catalog, and configure plans. Agency access is contract, pilot, and
            invoice driven — card processors are disabled.
          </p>
        </div>
        <CreateInvoiceLauncher />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          title="Create invoice"
          body="Pick an agency, edit line items, set PO # and due date, then save as draft or send."
          href="/rc-admin/invoices"
          cta="Open invoices"
          primary
        />
        <HubCard
          title="Service Catalog"
          body="Browse live catalog prices, select services, then create an invoice from the selection."
          href="/rc-admin/billing/services"
          cta="Open catalog"
        />
        <HubCard
          title="Pricing Menu"
          body="Master guide defaults and per-agency overrides for plans, verticals, CAD, and add-ons."
          href="/rc-admin/pricing"
          cta="Open pricing"
        />
      </section>

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

      <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-300">Technical notes</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Retired processor proxies under{" "}
            <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-sky-200">/api/billing/…</code> return{" "}
            <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-sky-200">410 Gone</code>.
          </li>
          <li>
            Keep Rapid Cortex platform rows distinct from RC Lite API-only plans via{" "}
            <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-sky-200">productLine</code>.
          </li>
        </ul>
      </details>
    </div>
  );
}

function HubCard({
  title,
  body,
  href,
  cta,
  primary,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        primary ? "border-violet-700/60 bg-violet-950/20" : "border-slate-800 bg-slate-950/40"
      }`}
    >
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
      <Link
        href={href}
        className={`mt-4 inline-flex text-sm font-semibold ${
          primary ? "text-violet-300 hover:text-violet-200" : "text-sky-400 hover:text-sky-300"
        }`}
      >
        {cta} →
      </Link>
    </div>
  );
}
