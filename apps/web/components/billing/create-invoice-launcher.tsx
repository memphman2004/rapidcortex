"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchAgencies } from "@/lib/api";
import { CreateAgencyInvoiceModal } from "@/components/billing/create-agency-invoice-modal";
import type { AgencyBillingSummary, UiLineItem } from "@/lib/rc-admin/agency-invoice-view";

type Props = {
  /** Opens the agency picker immediately (e.g. empty-state CTA). */
  defaultOpen?: boolean;
  /** Prefill line items (Service Catalog selection → dollars). */
  prefillItems?: UiLineItem[];
  /** Called after a successful create (before navigate). */
  onCreated?: () => void;
  buttonLabel?: string;
  buttonClassName?: string;
};

/**
 * Superadmin create-invoice entry: pick an agency, then reuse the agency billing create modal.
 * Creates operational invoices via POST /api/rc-admin/agencies/{id}/invoices.
 */
export function CreateInvoiceLauncher({
  defaultOpen = false,
  prefillItems,
  onCreated,
  buttonLabel = "+ Create invoice",
  buttonClassName =
    "rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50",
}: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(defaultOpen);
  const [agencyId, setAgencyId] = useState("");
  const [summary, setSummary] = useState<AgencyBillingSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agenciesQuery = useQuery({
    queryKey: ["agencies", "invoice-create"],
    queryFn: fetchAgencies,
    enabled: pickerOpen || modalOpen,
  });

  const agencyOptions = useMemo(() => {
    const items = agenciesQuery.data ?? [];
    return [...items].sort((a, b) =>
      (a.name ?? a.agencyId).localeCompare(b.name ?? b.agencyId, undefined, { sensitivity: "base" }),
    );
  }, [agenciesQuery.data]);

  async function continueToModal() {
    if (!agencyId.trim()) {
      setError("Select an agency.");
      return;
    }
    setError(null);
    setLoadingSummary(true);
    try {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing-summary`,
      );
      if (res.ok) {
        const body = (await res.json()) as AgencyBillingSummary;
        setSummary(body);
      } else {
        const picked = agencyOptions.find((a) => a.agencyId === agencyId);
        setSummary({
          agencyId,
          agencyName: picked?.name ?? agencyId,
          billingContactEmail: "",
          billingContactName: "",
          plan: "",
          currentMonthlyRate: 0,
        });
      }
      setPickerOpen(false);
      setModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load agency billing summary.");
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setPickerOpen(true)}>
        {buttonLabel}
      </button>

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f1221] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">Create invoice</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose the agency to bill. You can edit line items, PO number, and due date next.
            </p>

            <label className="mt-4 block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Agency
              </span>
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                disabled={agenciesQuery.isLoading}
              >
                <option value="">
                  {agenciesQuery.isLoading ? "Loading agencies…" : "Select agency…"}
                </option>
                {agencyOptions.map((a) => (
                  <option key={a.agencyId} value={a.agencyId}>
                    {a.name?.trim() || a.agencyId}
                  </option>
                ))}
              </select>
            </label>

            {agenciesQuery.isError ? (
              <p className="mt-2 text-sm text-rose-300">
                {agenciesQuery.error instanceof Error
                  ? agenciesQuery.error.message
                  : "Failed to load agencies."}
              </p>
            ) : null}
            {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!agencyId || loadingSummary}
                onClick={() => void continueToModal()}
                className="rounded bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {loadingSummary ? "Loading…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen && summary ? (
        <CreateAgencyInvoiceModal
          agencyId={summary.agencyId}
          agency={summary}
          prefillItems={prefillItems}
          onClose={() => {
            setModalOpen(false);
            setSummary(null);
          }}
          onCreated={(invoice) => {
            setModalOpen(false);
            setSummary(null);
            onCreated?.();
            router.push(
              `/rc-admin/agencies/${encodeURIComponent(invoice.agencyId)}/billing`,
            );
          }}
        />
      ) : null}
    </>
  );
}
