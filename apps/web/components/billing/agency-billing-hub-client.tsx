"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AgencyBillingSubnav } from "@/components/billing/agency-billing-subnav";
import { CreateAgencyInvoiceModal } from "@/components/billing/create-agency-invoice-modal";
import type {
  AgencyBillingSummary,
  UiAgencyInvoice,
  UiInvoiceStatus,
} from "@/lib/rc-admin/agency-invoice-view";

type Props = {
  agencyId: string;
};

const STATUS_STYLES: Record<
  UiInvoiceStatus,
  { className: string; label: string }
> = {
  draft: { className: "bg-slate-700/40 text-slate-300", label: "Draft" },
  sent: { className: "bg-sky-900/40 text-sky-300", label: "Sent" },
  paid: { className: "bg-emerald-900/40 text-emerald-300", label: "Paid" },
  void: { className: "bg-rose-900/30 text-rose-300", label: "Void" },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPeriod(period: string) {
  const [y, m] = period.split("-");
  if (!y || !m) return period;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "amber" | "emerald";
}) {
  const valueClass =
    accent === "amber" ? "text-amber-400" : accent === "emerald" ? "text-emerald-400" : "text-slate-100";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function AgencyBillingHubClient({ agencyId }: Props) {
  const searchParams = useSearchParams();
  const [agency, setAgency] = useState<AgencyBillingSummary | null>(null);
  const [invoices, setInvoices] = useState<UiAgencyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<UiInvoiceStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [firstInvoiceLoading, setFirstInvoiceLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const autoFirstInvoiceStarted = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [agencyRes, invoicesRes] = await Promise.all([
        fetch(`/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing-summary`),
        fetch(`/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/invoices`),
      ]);
      if (agencyRes.ok) setAgency((await agencyRes.json()) as AgencyBillingSummary);
      if (invoicesRes.ok) {
        setInvoices((await invoicesRes.json()) as UiAgencyInvoice[]);
      } else {
        const body = (await invoicesRes.json().catch(() => ({}))) as { error?: string };
        setLoadError(body.error ?? "Failed to load invoices");
      }
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleFirstInvoice = useCallback(async (opts?: { skipConfirm?: boolean }) => {
    if (
      !opts?.skipConfirm &&
      !window.confirm(
        `Create and send the first invoice for ${agency?.agencyName ?? agencyId}? This uses the assigned plan rate and emails ${agency?.billingContactEmail ?? "the billing contact"}.`,
      )
    ) {
      return;
    }
    setFirstInvoiceLoading(true);
    setLoadError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/invoices/first`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ send: true }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        invoice?: UiAgencyInvoice;
        billingCustomerAutoCreated?: boolean;
        sent?: boolean;
      };
      if (!res.ok) {
        setLoadError(body.message ?? body.error ?? "Failed to create first invoice.");
        return;
      }
      if (body.invoice) {
        setInvoices((prev) => [body.invoice!, ...prev]);
      }
      const parts = [
        body.sent ? "Invoice created and sent." : "Invoice created as draft.",
        body.billingCustomerAutoCreated ? "Billing customer auto-provisioned." : null,
        body.invoice?.invoiceNumber ? `#${body.invoice.invoiceNumber}` : null,
      ].filter(Boolean);
      setSuccessMessage(parts.join(" "));
      await fetchData();
    } finally {
      setFirstInvoiceLoading(false);
    }
  }, [agency?.agencyName, agency?.billingContactEmail, agencyId, fetchData]);

  useEffect(() => {
    if (loading || invoices.length > 0 || autoFirstInvoiceStarted.current) return;
    if (searchParams.get("firstInvoice") !== "1") return;
    autoFirstInvoiceStarted.current = true;
    void handleFirstInvoice({ skipConfirm: true });
  }, [handleFirstInvoice, invoices.length, loading, searchParams]);

  const filtered =
    statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter);

  const ytdTotal = invoices.filter((i) => i.status !== "void").reduce((s, i) => s + i.total, 0);
  const outstanding = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const lastPaid = invoices
    .filter((i) => i.status === "paid")
    .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime())[0];

  async function handleSend(invoice: UiAgencyInvoice) {
    if (!window.confirm(`Send invoice ${invoice.invoiceNumber} to ${invoice.billingContactEmail}?`)) return;
    setActionLoading(invoice.invoiceId);
    try {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/invoices/${encodeURIComponent(invoice.invoiceId)}/send`,
        { method: "POST" },
      );
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((i) =>
            i.invoiceId === invoice.invoiceId
              ? { ...i, status: "sent", sentAt: new Date().toISOString() }
              : i,
          ),
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkPaid(invoice: UiAgencyInvoice) {
    if (!window.confirm(`Mark ${invoice.invoiceNumber} as paid?`)) return;
    setActionLoading(invoice.invoiceId);
    try {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/invoices/${encodeURIComponent(invoice.invoiceId)}/paid`,
        { method: "POST" },
      );
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((i) =>
            i.invoiceId === invoice.invoiceId
              ? { ...i, status: "paid", paidAt: new Date().toISOString() }
              : i,
          ),
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVoid(invoice: UiAgencyInvoice) {
    if (!window.confirm(`Void invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    setActionLoading(invoice.invoiceId);
    try {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/invoices/${encodeURIComponent(invoice.invoiceId)}/void`,
        { method: "POST" },
      );
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((i) => (i.invoiceId === invoice.invoiceId ? { ...i, status: "void" } : i)),
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  function handleDownload(invoice: UiAgencyInvoice) {
    window.open(
      `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/invoices/${encodeURIComponent(invoice.invoiceId)}/pdf`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const filters: Array<UiInvoiceStatus | "all"> = ["all", "draft", "sent", "paid", "void"];

  return (
    <div className="space-y-6">
      <AgencyBillingSubnav agencyId={agencyId} active="billing" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Billing — {agency?.agencyName ?? agencyId}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Manage invoices, track payment status, and maintain billing records for this tenant.
            {agency?.billingContactEmail
              ? ` Billing contact: ${agency.billingContactEmail}`
              : null}
          </p>
          {!agency?.customerId && !agency?.billingCustomerAutoCreated ? (
            <p className="mt-2 text-xs text-amber-400/90">
              Billing customer will be auto-created from agency contacts when you issue the first invoice.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!loading && invoices.length === 0 ? (
            <button
              type="button"
              onClick={() => void handleFirstInvoice()}
              disabled={firstInvoiceLoading || !agency?.billingContactEmail}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                agency?.billingContactEmail
                  ? undefined
                  : "Add a billing contact email on the agency record first"
              }
            >
              {firstInvoiceLoading ? "Creating…" : "Create & send first invoice"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            + Create invoice
          </button>
        </div>
      </div>

      {agency?.billingCustomerAutoCreated ? (
        <p className="text-xs text-emerald-400/90">
          Billing customer record was auto-created from agency contacts for invoicing.
        </p>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Invoiced YTD" value={formatCurrency(ytdTotal)} />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          accent={outstanding > 0 ? "amber" : "emerald"}
        />
        <StatCard
          label="Last payment"
          value={lastPaid ? formatCurrency(lastPaid.total) : "—"}
          sub={lastPaid?.paidAt ? formatDate(lastPaid.paidAt) : undefined}
        />
        <StatCard
          label="Plan"
          value={agency?.plan ?? "—"}
          sub={
            agency && agency.currentMonthlyRate > 0
              ? `${formatCurrency(agency.currentMonthlyRate)}/mo`
              : undefined
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={
              statusFilter === f
                ? "rounded-md border border-violet-500/50 bg-violet-900/30 px-3 py-1.5 text-xs text-violet-200"
                : "rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
            }
          >
            {f === "all" ? "All invoices" : STATUS_STYLES[f].label}
            {f !== "all" ? (
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-[10px]">
                {invoices.filter((i) => i.status === f).length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="rounded border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading invoices…</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          {statusFilter === "all"
            ? 'No invoices yet. Click "Create invoice" to get started.'
            : `No ${statusFilter} invoices.`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const st = STATUS_STYLES[inv.status];
                const isLoading = actionLoading === inv.invoiceId;
                return (
                  <tr key={inv.invoiceId} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-violet-300">{inv.invoiceNumber}</span>
                      {inv.poNumber ? (
                        <p className="text-[10px] text-slate-500">PO: {inv.poNumber}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatPeriod(inv.billingPeriod)}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      {inv.lineItems.slice(0, 2).map((li) => (
                        <p key={li.id} className="truncate text-[11px] text-slate-500">
                          {li.description}
                        </p>
                      ))}
                      {inv.lineItems.length > 2 ? (
                        <p className="text-[11px] text-slate-600">+{inv.lineItems.length - 2} more</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${st.className}`}>
                        {st.label}
                      </span>
                      {inv.status === "paid" && inv.paidAt ? (
                        <p className="mt-0.5 text-[10px] text-emerald-400">{formatDate(inv.paidAt)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {inv.sentAt ? formatDate(inv.sentAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {(inv.pdfS3Key || inv.status !== "draft") && (
                          <button
                            type="button"
                            onClick={() => handleDownload(inv)}
                            disabled={isLoading}
                            className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                          >
                            PDF
                          </button>
                        )}
                        {inv.status === "draft" ? (
                          <button
                            type="button"
                            onClick={() => void handleSend(inv)}
                            disabled={isLoading}
                            className="rounded border border-sky-800/50 px-2 py-1 text-[11px] text-sky-400"
                          >
                            {isLoading ? "…" : "Send"}
                          </button>
                        ) : null}
                        {inv.status === "sent" ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkPaid(inv)}
                            disabled={isLoading}
                            className="rounded border border-emerald-800/50 px-2 py-1 text-[11px] text-emerald-400"
                          >
                            {isLoading ? "…" : "Mark paid"}
                          </button>
                        ) : null}
                        {inv.status === "draft" || inv.status === "sent" ? (
                          <button
                            type="button"
                            onClick={() => void handleVoid(inv)}
                            disabled={isLoading}
                            className="rounded border border-rose-900/40 px-2 py-1 text-[11px] text-rose-400"
                          >
                            Void
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
      )}

      {showCreate ? (
        <CreateAgencyInvoiceModal
          agencyId={agencyId}
          agency={agency}
          onClose={() => setShowCreate(false)}
          onCreated={(inv) => {
            setInvoices((prev) => [inv, ...prev]);
            setShowCreate(false);
          }}
        />
      ) : null}
    </div>
  );
}
