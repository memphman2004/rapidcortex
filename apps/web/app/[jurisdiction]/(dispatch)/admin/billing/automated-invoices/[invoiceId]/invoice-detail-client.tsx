"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAutomatedInvoice } from "@/lib/billing/invoices-api";
import { formatBillingPeriodLabel, formatCentsUsd, formatIsoDate, invoiceStatusClass } from "@/lib/billing/billing-utils";

export function AgencyAutomatedInvoiceDetailClient({ invoiceId }: { invoiceId: string }) {
  const query = useQuery({
    queryKey: ["agency-automated-invoice", invoiceId],
    queryFn: () => fetchAutomatedInvoice(invoiceId),
  });
  const invoice = query.data?.invoice;
  if (query.isLoading) return <p className="text-sm text-slate-400">Loading invoice…</p>;
  if (query.isError || !invoice) {
    return <p className="text-sm text-red-400">{query.error instanceof Error ? query.error.message : "Invoice not found"}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500">{invoice.invoiceId}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{formatBillingPeriodLabel(invoice.billingPeriod)}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {invoice.planLabel} — {invoice.tierLabel} · Due {formatIsoDate(invoice.dueDate)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${invoiceStatusClass(invoice.status)}`}>
          {invoice.status}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.lineId} className="border-t border-slate-800">
                <td className="px-4 py-3 text-slate-200">{line.description}</td>
                <td className="px-4 py-3 text-right text-white">{formatCentsUsd(line.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-right text-lg font-semibold text-white">Total due {formatCentsUsd(invoice.totalCents)}</p>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        <h2 className="font-semibold text-white">How to pay</h2>
        <p className="mt-2 leading-relaxed">
          NET 30 from {formatIsoDate(invoice.invoiceDate)}. ACH (Navy Federal Credit Union, routing 256074974) or wire (SWIFT
          NFCUUS33), payable to Apps on Demand LLC. Account numbers are sent separately to your billing contact.
        </p>
      </section>
    </div>
  );
}
