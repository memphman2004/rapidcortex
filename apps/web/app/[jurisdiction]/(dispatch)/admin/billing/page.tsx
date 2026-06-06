"use client";

import Link from "next/link";
import { ONE_TIME_FEE_CATALOG, SUBSCRIPTION_PLANS } from "rapid-cortex-shared";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export default function AdminBillingCatalogPage() {
  const to = useJurisdictionLink();
  return (
    <div className="space-y-10 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Billing & plans</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Public-sector first: municipalities can run <strong className="text-slate-300">invoice-first</strong> billing
          through purchase orders and ACH where your policy allows. Catalog SKUs align packaged plans with procurement
          references—collection follows your agency contract package.
        </p>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Subscription packages
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {SUBSCRIPTION_PLANS.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium text-slate-100">{p.name}</h3>
                <span className="shrink-0 text-sm font-semibold text-emerald-300/90">
                  {p.displayHint}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{p.summary}</p>
              <p className="mt-2 font-mono text-[10px] text-slate-600">SKU {p.catalogItemSku}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          One-time fees (catalog)
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {ONE_TIME_FEE_CATALOG.map((f) => (
            <li
              key={f.kind}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800/80 bg-slate-950/40 px-3 py-2"
            >
              <span>{f.label}</span>
              <span className="text-emerald-300/90">{f.displayHint}</span>
              <span className="w-full font-mono text-[10px] text-slate-600 sm:w-auto">{f.catalogItemSku}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-200/80">
          Agency billing workspace
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Agency admins manage their tenant billing profile, payment mode, and subscription lifecycle.
          Platform staff can open any agency from <span className="font-mono">Tenants</span> → Billing.
        </p>
        <p className="mt-3 text-sm">
          <Link href={to("/admin/platform/agencies")} className="text-sky-400 hover:underline">
            Open platform agencies
          </Link>{" "}
          — select a tenant, then use its billing workspace (no hardcoded sample agency in pilot builds).
        </p>
      </section>
    </div>
  );
}
