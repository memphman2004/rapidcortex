"use client";

import type { LoadoutInvoice } from "rapid-cortex-shared/loadout";

interface InvoicePreviewPanelProps {
  invoice: LoadoutInvoice | null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function InvoicePreviewPanel({ invoice }: InvoicePreviewPanelProps) {
  if (!invoice) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 text-sm text-slate-400">
        No invoice preview available for current period.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Invoice Preview</h3>
          <p className="text-xs text-slate-500 mt-0.5">Period: {invoice.period} · Due: {invoice.dueDate}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          invoice.status === "sent" ? "bg-emerald-900 text-emerald-300" :
          invoice.status === "generated" ? "bg-sky-900 text-sky-300" :
          "bg-slate-700 text-slate-300"
        }`}>
          {invoice.status}
        </span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            <th className="text-left py-1.5 font-medium">Feature</th>
            <th className="text-right py-1.5 font-medium">Calls</th>
            <th className="text-right py-1.5 font-medium">Base</th>
            <th className="text-right py-1.5 font-medium">Overage</th>
            <th className="text-right py-1.5 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item) => (
            <tr key={item.featureId} className="border-b border-slate-800/50 text-slate-300">
              <td className="py-1.5">{item.featureName}</td>
              <td className="text-right py-1.5">{item.callsUsed.toLocaleString()}</td>
              <td className="text-right py-1.5">{formatCents(item.baseCents)}</td>
              <td className="text-right py-1.5">{formatCents(item.overageCents)}</td>
              <td className="text-right py-1.5 font-medium text-white">{formatCents(item.totalCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-white font-semibold">
            <td colSpan={4} className="pt-3 text-right">Total Due</td>
            <td className="pt-3 text-right text-violet-300">{formatCents(invoice.totalDueCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
