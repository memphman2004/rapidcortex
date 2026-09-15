"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AutomatedInvoiceStatus } from "rapid-cortex-shared";
import { fetchAutomatedInvoice, patchAutomatedInvoice, resendAutomatedInvoice } from "@/lib/billing/invoices-api";
import { formatBillingPeriodLabel, formatCentsUsd, formatIsoDate, invoiceStatusClass } from "@/lib/billing/billing-utils";

export function AutomatedInvoiceDetailClient({ invoiceId }: { invoiceId: string }) {
  const qc = useQueryClient();
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["automated-invoice", invoiceId],
    queryFn: () => fetchAutomatedInvoice(invoiceId),
  });

  const patch = useMutation({
    mutationFn: (body: { status?: AutomatedInvoiceStatus; voidReason?: string }) => patchAutomatedInvoice(invoiceId, body),
    onSuccess: async () => {
      setMessage("Invoice updated.");
      setVoidOpen(false);
      await qc.invalidateQueries({ queryKey: ["automated-invoice", invoiceId] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const resend = useMutation({
    mutationFn: () => resendAutomatedInvoice(invoiceId),
    onSuccess: async (res) => {
      setMessage(res.sent ? "Invoice email resent." : `Email skipped (${res.skipped ?? "not sent"})`);
      await qc.invalidateQueries({ queryKey: ["automated-invoice", invoiceId] });
    },
    onError: (err: Error) => setMessage(err.message),
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
          <h1 className="mt-1 text-2xl font-semibold text-white">{invoice.agencyName}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {formatBillingPeriodLabel(invoice.billingPeriod)} · {invoice.planLabel} — {invoice.tierLabel}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${invoiceStatusClass(invoice.status)}`}>
          {invoice.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={invoice.status === "voided" || resend.isPending}
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-40"
        >
          Resend email
        </button>
        <button
          type="button"
          onClick={() => patch.mutate({ status: "paid" })}
          disabled={!["sent", "overdue", "disputed"].includes(invoice.status) || patch.isPending}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          Mark paid
        </button>
        {invoice.status === "draft" ? (
          <button
            type="button"
            onClick={() => patch.mutate({ status: "sent" })}
            disabled={patch.isPending}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-600"
          >
            Approve / send
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setVoidOpen(true)}
          disabled={invoice.status === "paid" || invoice.status === "voided"}
          className="rounded-lg border border-red-800 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950 disabled:opacity-40"
        >
          Void
        </button>
      </div>

      {message ? <p className="text-sm text-slate-300">{message}</p> : null}

      {voidOpen ? (
        <div className="rounded-xl border border-red-900 bg-slate-900 p-4">
          <p className="text-sm font-medium text-red-200">Void this invoice?</p>
          <textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Reason (required for audit)"
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => patch.mutate({ status: "voided", voidReason })}
              disabled={!voidReason.trim() || patch.isPending}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Confirm void
            </button>
            <button type="button" onClick={() => setVoidOpen(false)} className="text-sm text-slate-400">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Plan" body={`${invoice.planLabel} — ${invoice.tierLabel}${invoice.proRated ? ` (pro-rated ${invoice.proRationDays} days)` : ""}`} />
        <InfoCard title="Invoice / due" body={`${formatIsoDate(invoice.invoiceDate)} · NET 30 ${formatIsoDate(invoice.dueDate)}`} />
        <InfoCard title="Payment" body={`${invoice.paymentMethod.toUpperCase()} · ${invoice.billingContactEmail}`} />
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-center font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.lineId} className="border-t border-slate-800">
                <td className={`px-4 py-3 ${line.amountCents < 0 ? "text-emerald-300" : "text-slate-200"}`}>{line.description}</td>
                <td className="px-4 py-3 text-center text-slate-400">
                  {line.quantity} {line.unitLabel}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${line.amountCents < 0 ? "text-emerald-300" : "text-white"}`}>
                  {line.amountCents < 0 ? `(${formatCentsUsd(Math.abs(line.amountCents))})` : formatCentsUsd(line.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="ml-auto max-w-xs space-y-1 text-sm">
        <Row label="Subtotal" value={formatCentsUsd(invoice.subtotalCents)} />
        {invoice.discountCents > 0 ? <Row label="Discounts" value={`(${formatCentsUsd(invoice.discountCents)})`} accent /> : null}
        <Row label="Total due" value={formatCentsUsd(invoice.totalCents)} bold />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        <h2 className="font-semibold text-white">Status history</h2>
        <ul className="mt-2 space-y-1 text-slate-400">
          <li>Created {formatIsoDate(invoice.createdAt)}</li>
          {invoice.emailSentAt ? <li>Emailed {formatIsoDate(invoice.emailSentAt)}</li> : null}
          {invoice.paidAt ? <li>Paid {formatIsoDate(invoice.paidAt)}</li> : null}
          {invoice.voidedAt ? <li>Voided {formatIsoDate(invoice.voidedAt)} {invoice.voidReason ? `— ${invoice.voidReason}` : ""}</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        <h2 className="font-semibold text-white">Payment instructions</h2>
        <p className="mt-2 leading-relaxed">
          NET 30 · ACH Navy Federal Credit Union · Routing 256074974 · Account name Apps on Demand LLC · Wire SWIFT NFCUUS33.
          Account numbers are provided separately. Late fee 1.5%/month; suspension after 60 days overdue.
        </p>
      </section>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-200">{body}</p>
    </div>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-slate-700 pt-2 text-base font-semibold text-white" : ""} ${accent ? "text-emerald-300" : "text-slate-300"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
