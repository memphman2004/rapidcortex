"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminInvoices, patchAdminInvoice, type AdminInvoiceListItem } from "@/lib/api";
import { VerticalBadge, type Vertical } from "@/components/ui/VerticalBadge";

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue" | "void";
type VerticalFilter = "all" | Vertical;

function formatUsdFromDollars(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString();
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeVertical(value: string): Vertical {
  if (value === "campus" || value === "venue" || value === "hospital") return value;
  return "core";
}

export function RcAdminInvoicesClient() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [vertical, setVertical] = useState<VerticalFilter>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useQuery({
    queryKey: ["admin-invoices", status, vertical, search, from, to],
    queryFn: () =>
      fetchAdminInvoices({
        limit: 50,
        status,
        vertical,
        search: search.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const items = query.data?.items ?? [];
  const stats = query.data?.stats;
  const showPoColumn = useMemo(
    () => items.some((row) => Boolean(row.purchaseOrderNumber?.trim())),
    [items],
  );

  async function markPaid(row: AdminInvoiceListItem) {
    if (!window.confirm(`Mark invoice ${row.invoiceNumber ?? row.invoiceId} as paid?`)) return;
    await patchAdminInvoice(row.invoiceId, { status: "paid" });
    await query.refetch();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Invoices & PO</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Cross-tenant invoice registry for government and enterprise procurement. Track PO numbers, due dates, and
          manual paid status on monetization invoice records.
        </p>
        <Link href="/rc-admin/billing" className="inline-block text-sm text-sky-400 hover:text-sky-300">
          ← Billing hub
        </Link>
      </header>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total invoices" value={String(stats.totalInvoices)} />
          <StatCard label="Outstanding" value={formatUsdFromCents(stats.outstandingCents)} />
          <StatCard label="Overdue" value={formatUsdFromCents(stats.overdueCents)} accent="rose" />
          <StatCard label="Paid this month" value={formatUsdFromCents(stats.paidThisMonthCents)} accent="emerald" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search agency, invoice #, PO…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value as VerticalFilter)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">All verticals</option>
          <option value="core">Core</option>
          <option value="campus">Campus</option>
          <option value="venue">Venue</option>
          <option value="hospital">Hospital</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          aria-label="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          aria-label="To date"
        />
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-slate-800/80" />
          ))}
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <p>{query.error instanceof Error ? query.error.message : "Failed to load invoices."}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 rounded border border-rose-800 px-2 py-1 text-xs hover:bg-rose-950/50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400">
          No invoices yet. Invoices are created automatically when add-ons are enabled or when a billing cycle
          completes.
          {query.data?.note ? <p className="mt-2 text-xs text-amber-300/90">{query.data.note}</p> : null}
        </div>
      ) : null}

      {!query.isLoading && !query.isError && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Agency</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                {showPoColumn ? <th className="px-3 py-2">PO #</th> : null}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((row) => {
                const paid = row.displayStatus === "paid";
                const overdue = row.displayStatus === "overdue";
                return (
                  <tr
                    key={row.invoiceId}
                    className={paid ? "bg-slate-950/20 text-slate-400" : "bg-slate-950/30 text-slate-200"}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/rc-admin/invoices/${encodeURIComponent(row.invoiceId)}`}
                        className="font-medium text-sky-400 hover:text-sky-300"
                      >
                        {row.invoiceNumber ?? row.invoiceId}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.agencyName}</span>
                        <VerticalBadge vertical={normalizeVertical(row.vertical)} size="xs" />
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatDate(row.createdAt)}</td>
                    <td className={`px-3 py-2 ${overdue ? "font-medium text-rose-300" : ""}`}>
                      {formatDate(row.dueDate)}
                    </td>
                    <td className="px-3 py-2">{formatUsdFromDollars(row.total)}</td>
                    <td className="px-3 py-2">{statusLabel(row.displayStatus)}</td>
                    {showPoColumn ? (
                      <td className="px-3 py-2">{row.purchaseOrderNumber ?? "—"}</td>
                    ) : null}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link
                          href={`/rc-admin/invoices/${encodeURIComponent(row.invoiceId)}`}
                          className="text-sky-400 hover:text-sky-300"
                        >
                          View
                        </Link>
                        {!paid && row.displayStatus !== "void" ? (
                          <button
                            type="button"
                            onClick={() => void markPaid(row)}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            Mark paid
                          </button>
                        ) : null}
                      </div>
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "rose" | "emerald";
}) {
  const color =
    accent === "rose" ? "text-rose-300" : accent === "emerald" ? "text-emerald-300" : "text-white";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
