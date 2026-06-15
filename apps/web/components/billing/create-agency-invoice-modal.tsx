"use client";

import { useEffect, useState } from "react";
import {
  addDaysIso,
  type AgencyBillingSummary,
  type UiAgencyInvoice,
  type UiLineItem,
} from "@/lib/rc-admin/agency-invoice-view";

type Props = {
  agencyId: string;
  agency: AgencyBillingSummary | null;
  prefillItems?: UiLineItem[];
  onClose: () => void;
  onCreated: (invoice: UiAgencyInvoice) => void;
};

function newLineItem(): UiLineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    total: 0,
  };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function CreateAgencyInvoiceModal({
  agencyId,
  agency,
  prefillItems,
  onClose,
  onCreated,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [billingPeriod, setBillingPeriod] = useState(today.slice(0, 7));
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysIso(today, 30));
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<UiLineItem[]>(
    prefillItems?.length ? prefillItems : [newLineItem()],
  );
  const [saving, setSaving] = useState(false);
  const [sendNow, setSendNow] = useState(false);
  const [error, setError] = useState("");

  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function updateItem(id: string, field: keyof UiLineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.total = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }),
    );
  }

  async function handleSubmit() {
    if (!agency) return;
    if (lineItems.some((i) => !i.description.trim())) {
      setError("All line items must have a description.");
      return;
    }
    if (subtotal <= 0) {
      setError("Invoice total must be greater than $0.");
      return;
    }
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/rc-admin/agencies/${agencyId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingPeriod,
          invoiceDate,
          dueDate,
          poNumber: poNumber || undefined,
          notes: notes || undefined,
          lineItems,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }

      const created = (await res.json()) as UiAgencyInvoice;

      if (sendNow) {
        await fetch(
          `/api/rc-admin/agencies/${agencyId}/invoices/${encodeURIComponent(created.invoiceId)}/send`,
          { method: "POST" },
        );
        created.status = "sent";
        created.sentAt = new Date().toISOString();
      }

      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1221]">
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Create invoice</h2>
            {agency ? <p className="mt-1 text-xs text-slate-500">{agency.agencyName}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Billing period
              </span>
              <input
                type="month"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Invoice date
              </span>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setDueDate(addDaysIso(e.target.value, 30));
                }}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Due date (NET 30)
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                PO number
              </span>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Agency PO #"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
          </div>

          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Line items</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-2">Description</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Unit price</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="py-2 pr-2">
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="Service or feature name"
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      />
                    </td>
                    <td className="px-1 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center text-xs text-slate-100"
                      />
                    </td>
                    <td className="px-1 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                        className="w-24 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-right text-xs text-slate-100"
                      />
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-slate-200">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setLineItems((prev) => prev.filter((row) => row.id !== item.id))
                        }
                        disabled={lineItems.length === 1}
                        className="text-rose-400 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setLineItems((prev) => [...prev, newLineItem()])}
            className="mt-2 w-full rounded border border-dashed border-white/15 px-3 py-2 text-xs text-sky-400 hover:bg-white/5"
          >
            + Add line item
          </button>

          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>$0.00 (exempt)</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-violet-300">
                <span>Total due</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
            </div>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Notes (internal only)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>

          {error ? (
            <p className="mt-3 rounded border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
            Send to {agency?.billingContactEmail ?? "billing contact"} immediately
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {saving ? "Creating…" : sendNow ? "Create & send" : "Save as draft"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
