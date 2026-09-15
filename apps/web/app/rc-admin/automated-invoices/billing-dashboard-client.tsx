"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AutomatedInvoice, AutomatedInvoiceStatus } from "rapid-cortex-shared";
import { fetchAutomatedInvoices } from "@/lib/billing/invoices-api";
import { formatBillingPeriodLabel, formatCentsUsd, formatIsoDate, invoiceStatusClass } from "@/lib/billing/billing-utils";

const TABS: Array<{ id: "all" | AutomatedInvoiceStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "paid", label: "Paid" },
  { id: "overdue", label: "Overdue" },
  { id: "voided", label: "Voided" },
  { id: "disputed", label: "Disputed" },
];

export function AutomatedBillingDashboardClient() {
  const [status, setStatus] = useState<"all" | AutomatedInvoiceStatus>("all");
  const [period, setPeriod] = useState("");
  const [agency, setAgency] = useState("");
  const [planId, setPlanId] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 120_000);
    return () => window.clearInterval(id);
  }, []);

  const query = useQuery({
    queryKey: ["automated-invoices", status, period, agency, planId, tick],
    queryFn: () =>
      fetchAutomatedInvoices({
        status,
        billingPeriod: period || undefined,
        agencyId: agency.trim() || undefined,
        planId: planId || undefined,
        limit: 100,
      }),
    refetchInterval: 120_000,
  });

  const invoices = query.data?.invoices ?? [];
  const totals = useMemo(() => {
    const byStatus: Record<string, number> = {};
    let sum = 0;
    for (const inv of invoices) {
      sum += inv.totalCents;
      byStatus[inv.status] = (byStatus[inv.status] ?? 0) + 1;
    }
    return { sum, byStatus, count: invoices.length };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === tab.id ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Agency ID"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">All plans</option>
          <option value="essential">Essential</option>
          <option value="professional">Professional</option>
          <option value="command">Command</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {query.isError ? (
        <p className="text-sm text-red-400">{query.error instanceof Error ? query.error.message : "Failed to load invoices"}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice #</th>
              <th className="px-4 py-3 font-medium">Agency</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Invoice Date</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <InvoiceRow key={inv.invoiceId} invoice={inv} />
            ))}
            {invoices.length === 0 && !query.isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No automated invoices match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
        <span>
          {totals.count} invoice{totals.count === 1 ? "" : "s"} · Draft {totals.byStatus.draft ?? 0} · Sent {totals.byStatus.sent ?? 0} · Paid{" "}
          {totals.byStatus.paid ?? 0} · Overdue {totals.byStatus.overdue ?? 0}
        </span>
        <span className="font-semibold text-white">Visible total {formatCentsUsd(totals.sum)}</span>
      </div>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: AutomatedInvoice }) {
  return (
    <tr className="border-t border-slate-800 text-slate-200">
      <td className="px-4 py-3 font-mono text-xs">{invoice.invoiceId}</td>
      <td className="px-4 py-3">{invoice.agencyName}</td>
      <td className="px-4 py-3">{formatBillingPeriodLabel(invoice.billingPeriod)}</td>
      <td className="px-4 py-3">{invoice.planLabel}</td>
      <td className="px-4 py-3 font-medium">{formatCentsUsd(invoice.totalCents)}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${invoiceStatusClass(invoice.status)}`}>
          {invoice.status}
        </span>
      </td>
      <td className="px-4 py-3">{formatIsoDate(invoice.invoiceDate)}</td>
      <td className="px-4 py-3">{formatIsoDate(invoice.dueDate)}</td>
      <td className="px-4 py-3">
        <Link href={`/rc-admin/automated-invoices/${encodeURIComponent(invoice.invoiceId)}`} className="text-violet-300 hover:text-violet-200">
          View
        </Link>
      </td>
    </tr>
  );
}
