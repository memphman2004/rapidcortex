"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvoiceRecord } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { fetchAgencyBillingInvoices, isApiConfigured } from "@/lib/api";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPeriod(issueDate: string): string {
  const d = new Date(issueDate);
  if (Number.isNaN(d.getTime())) return issueDate;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function statusLabel(state: InvoiceRecord["state"]): { text: string; className: string } {
  if (state === "paid") {
    return { text: "Paid", className: "bg-emerald-500/15 text-emerald-300" };
  }
  if (state === "voided") {
    return { text: "Void", className: "bg-slate-500/15 text-slate-400" };
  }
  return { text: "Due", className: "bg-sky-500/15 text-sky-300" };
}

export function AgencyInvoicesPanel() {
  const { user } = useSession();
  const agencyId = user?.agencyId ?? "";
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!agencyId) return;
    if (!isApiConfigured()) {
      setError("API is not configured in this deployment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAgencyBillingInvoices(agencyId);
      setInvoices(items.filter((inv) => inv.state !== "draft" && inv.state !== "voided"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoices.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Invoices</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Your billing history. Contact your Rapid Cortex account manager with questions about payment
          terms or procurement references.
        </p>
      </div>

      {loading && invoices.length === 0 ? (
        <p className="text-sm text-slate-500">Loading invoices…</p>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-rose-700/60 px-2 py-1 text-xs text-rose-100 hover:bg-rose-900/30"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && invoices.length === 0 ? (
        <p className="py-10 text-sm text-slate-500">No invoices on file yet.</p>
      ) : null}

      {invoices.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const badge = statusLabel(inv.state);
                const pdfHref = `/api/backend/api/billing/invoices/${encodeURIComponent(inv.invoiceId)}/pdf?agencyId=${encodeURIComponent(agencyId)}&refresh=1`;
                return (
                  <tr
                    key={inv.invoiceId}
                    className={i % 2 === 1 ? "bg-white/[0.02]" : undefined}
                  >
                    <td className="px-3 py-2.5 font-mono text-[11px] text-violet-300">{inv.invoiceId}</td>
                    <td className="px-3 py-2.5 text-slate-300">{formatPeriod(inv.issueDate)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                      {formatCurrency(inv.totalCents)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[11px] ${badge.className}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {new Date(inv.dueDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <a href={pdfHref} className="text-[11px] text-sky-400 hover:underline">
                        Download PDF
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
