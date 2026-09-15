"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchAutomatedBillingConfig, fetchAutomatedInvoices } from "@/lib/billing/invoices-api";
import { formatBillingPeriodLabel, formatCentsUsd, formatIsoDate, invoiceStatusClass } from "@/lib/billing/billing-utils";

export function AgencyAutomatedBillingClient({ jurisdiction }: { jurisdiction: string }) {
  const invoicesQuery = useQuery({
    queryKey: ["agency-automated-invoices"],
    queryFn: () => fetchAutomatedInvoices({ limit: 50 }),
  });
  const configQuery = useQuery({
    queryKey: ["agency-automated-config"],
    queryFn: () => fetchAutomatedBillingConfig(),
  });

  const invoices = invoicesQuery.data?.invoices ?? [];
  const config = configQuery.data?.config;

  return (
    <div className="space-y-6">
      {config ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-white">Current contract</h2>
          <p className="mt-2 text-sm text-slate-300">
            {config.planId} · {config.contractedDispatcherSeats} dispatcher seats · {config.addons.filter((a) => !a.disabledAt).length} add-ons
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Billing contact {config.billingContactName} · {config.billingContactEmail}
          </p>
        </section>
      ) : configQuery.isError ? (
        <p className="text-sm text-slate-500">No automated billing contract is on file yet.</p>
      ) : null}

      {invoicesQuery.isError ? (
        <p className="text-sm text-red-400">
          {invoicesQuery.error instanceof Error ? invoicesQuery.error.message : "Unable to load invoices"}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice #</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.invoiceId} className="border-t border-slate-800 text-slate-200">
                <td className="px-4 py-3">
                  <Link
                    href={`/${jurisdiction}/admin/billing/automated-invoices/${encodeURIComponent(inv.invoiceId)}`}
                    className="font-mono text-xs text-sky-300 hover:text-sky-200"
                  >
                    {inv.invoiceId}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatBillingPeriodLabel(inv.billingPeriod)}</td>
                <td className="px-4 py-3">{formatCentsUsd(inv.totalCents)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${invoiceStatusClass(inv.status)}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3">{formatIsoDate(inv.dueDate)}</td>
              </tr>
            ))}
            {invoices.length === 0 && !invoicesQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No invoices yet for this agency.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
