"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminInvoice, patchAdminInvoice } from "@/lib/api";
import { VerticalBadge, type Vertical } from "@/components/ui/VerticalBadge";

type Props = { invoiceId: string };

function formatUsd(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleString();
}

function normalizeVertical(value: string): Vertical {
  if (value === "campus" || value === "venue" || value === "hospital") return value;
  return "core";
}

export function RcAdminInvoiceDetailClient({ invoiceId }: Props) {
  const [poDraft, setPoDraft] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-invoice", invoiceId],
    queryFn: () => fetchAdminInvoice(invoiceId),
  });

  const invoice = query.data?.invoice;
  const lineItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  const poValue = poDraft ?? invoice?.purchaseOrderNumber ?? "";

  async function savePo() {
    if (!invoice) return;
    await patchAdminInvoice(invoice.invoiceId, { purchaseOrderNumber: poValue.trim() });
    setPoDraft(null);
    await query.refetch();
  }

  async function markPaid() {
    if (!invoice) return;
    if (!window.confirm("Mark this invoice as paid?")) return;
    await patchAdminInvoice(invoice.invoiceId, { status: "paid" });
    await query.refetch();
  }

  if (query.isLoading) {
    return <p className="text-sm text-slate-400">Loading invoice…</p>;
  }

  if (query.isError || !invoice) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-300">
          {query.error instanceof Error ? query.error.message : "Invoice not found."}
        </p>
        <Link href="/rc-admin/invoices" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const isDraft = invoice.status.toLowerCase() === "draft";
  const isPaid = invoice.status.toLowerCase() === "paid";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/rc-admin/invoices" className="text-sm text-sky-400 hover:text-sky-300">
          ← All invoices
        </Link>
        <VerticalBadge vertical={normalizeVertical(invoice.vertical)} size="xs" />
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">
          Invoice {invoice.invoiceNumber ?? invoice.invoiceId}
        </h1>
        <p className="text-sm text-slate-400">
          {invoice.agencyName} · {invoice.agencyId}
        </p>
      </header>

      <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Status" value={invoice.status} />
        <Meta label="Issued" value={formatDate(invoice.createdAt)} />
        <Meta label="Due" value={formatDate(invoice.dueDate)} />
        <Meta label="Total" value={formatUsd(invoice.total)} />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Purchase order</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={poValue}
            onChange={(e) => setPoDraft(e.target.value)}
            disabled={!isDraft}
            placeholder="PO number"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          />
          {isDraft ? (
            <button
              type="button"
              onClick={() => void savePo()}
              className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600"
            >
              Save PO
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Line items</h2>
        {lineItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No line items recorded on this invoice.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1">Description</th>
                  <th className="px-2 py-1">Qty</th>
                  <th className="px-2 py-1">Unit</th>
                  <th className="px-2 py-1">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {lineItems.map((raw, idx) => {
                  const row = raw as Record<string, unknown>;
                  const qty = Number(row.quantity ?? 1);
                  const unit = Number(row.unitPrice ?? row.unitAmountCents ?? row.monthlyAmountCents ?? 0);
                  const amount = Number(row.lineTotal ?? row.amount ?? qty * unit);
                  return (
                    <tr key={String(row.lineItemId ?? row.lineId ?? idx)}>
                      <td className="px-2 py-2">
                        {String(row.description ?? row.serviceName ?? row.addonKey ?? "Line item")}
                      </td>
                      <td className="px-2 py-2">{qty}</td>
                      <td className="px-2 py-2">{formatUsd(unit)}</td>
                      <td className="px-2 py-2">{formatUsd(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-4 text-sm text-slate-300">
          <span>Subtotal: {formatUsd(invoice.subtotal)}</span>
          <span className="font-semibold text-white">Total: {formatUsd(invoice.total)}</span>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {!isPaid ? (
          <button
            type="button"
            onClick={() => void markPaid()}
            className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600"
          >
            Mark as paid
          </button>
        ) : (
          <p className="text-sm text-emerald-300">Paid {invoice.paidAt ? formatDate(invoice.paidAt) : ""}</p>
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}
