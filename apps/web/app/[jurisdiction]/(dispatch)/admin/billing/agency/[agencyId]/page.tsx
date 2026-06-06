"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import {
  fetchAgencyBillingProfile,
  patchAgencyBillingProfile,
  postBillingSubscriptionCancel,
  postBillingSubscriptionChange,
} from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isRcInternalOperator } from "rapid-cortex-shared";
import type { ChangeSubscriptionPlanInput, SubscriptionPlanId } from "rapid-cortex-shared";

export default function AgencyBillingWorkspacePage() {
  const to = useJurisdictionLink();
  const params = useParams();
  const agencyId = typeof params.agencyId === "string" ? params.agencyId : "";
  const { user, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const isRcOperator = Boolean(user && isRcInternalOperator(user.role));
  const isAgencyScopedViewer = Boolean(user && user.agencyId === agencyId);
  const canAccess = Boolean(user && (isRcOperator || isAgencyScopedViewer));
  const canManage = isRcOperator;

  const profileQuery = useQuery({
    queryKey: ["billing-profile", agencyId],
    queryFn: () => fetchAgencyBillingProfile(agencyId),
    enabled: Boolean(agencyId) && Boolean(canAccess),
  });

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [apEmail, setApEmail] = useState("");
  const [poRef, setPoRef] = useState("");

  const patchMut = useMutation({
    mutationFn: () => {
      if (!canManage) throw new Error("FORBIDDEN");
      return (
      patchAgencyBillingProfile(agencyId, {
        billingContactName: contactName || undefined,
        billingContactEmail: contactEmail || undefined,
        accountsPayableEmail: apEmail || undefined,
        purchaseOrderRef: poRef || undefined,
      })
      );
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["billing-profile", agencyId] }),
  });

  const planMut = useMutation({
    mutationFn: (body: ChangeSubscriptionPlanInput) => {
      if (!canManage) throw new Error("FORBIDDEN");
      return postBillingSubscriptionChange(agencyId, body);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["billing-profile", agencyId] }),
  });

  const cancelMut = useMutation({
    mutationFn: () => {
      if (!canManage) throw new Error("FORBIDDEN");
      return postBillingSubscriptionCancel(agencyId, { reason: "User requested cancel" });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["billing-profile", agencyId] }),
  });

  if (sessionLoading) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (!canAccess) {
    return <p className="p-6 text-sm text-rose-300">You cannot manage billing for this agency.</p>;
  }

  const p = profileQuery.data;

  return (
    <div className="space-y-8 p-4 md:p-6">
      <p className="text-sm text-slate-500">
        <Link href={to("/admin/billing")} className="text-sky-400 hover:underline">
          ← Plans catalog
        </Link>
      </p>
      <h1 className="text-lg font-semibold text-white">Agency billing</h1>
      <p className="font-mono text-xs text-slate-500">{agencyId}</p>
      {!canManage ? (
        <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
          Read-only mode: agency accounts can view only their own billing workspace. Plan and profile updates require an
          RC internal operator account.
        </p>
      ) : null}

      {profileQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading profile…</p>
      ) : profileQuery.isError || !p ? (
        <p className="text-sm text-rose-300">Failed to load billing profile.</p>
      ) : (
        <>
          <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Account status
              </h2>
              <dl className="mt-2 space-y-1 text-sm text-slate-300">
                <div>
                  <dt className="text-xs text-slate-500">Billing account</dt>
                  <dd>{p.billingAccount.status}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Payment mode</dt>
                  <dd>{p.paymentMode}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Public self-serve card checkout</dt>
                  <dd>{p.selfServeCheckoutEnabled ? "listed (not enabled in product)" : "disabled"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Delinquency</dt>
                  <dd>
                    {p.delinquency.tier} · {p.delinquency.asOf}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Assigned plan</dt>
                  <dd>{p.assignedPlanId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Subscription lifecycle</dt>
                  <dd>{p.subscription?.lifecycle ?? "—"}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Archived external billing references
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Read-only fields from historical billing snapshots. Prefer normalized external customer/subscription ids on
                the agency tenant record when reconciling finance systems.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Archived customer ref:{" "}
                <span className="font-mono text-slate-400">
                  {p.billingAccount.archivedExternalCustomerId ?? "—"}
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Archived subscription ref:{" "}
                <span className="font-mono text-slate-400">
                  {p.subscription?.archivedExternalSubscriptionId ?? "—"}
                </span>
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Billing contacts & PO
            </h2>
            <form
              className="mt-4 grid max-w-xl gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                patchMut.mutate();
              }}
            >
              <input
                placeholder="Billing contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="email"
                placeholder="Billing contact email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="email"
                placeholder="Accounts payable email"
                value={apEmail}
                onChange={(e) => setApEmail(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <input
                placeholder="Purchase order / contract ref"
                value={poRef}
                onChange={(e) => setPoRef(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="submit"
                disabled={!canManage || patchMut.isPending}
                className="w-fit rounded-md bg-sky-800 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {patchMut.isPending ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Plan change (upgrade / downgrade)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Plan changes call the billing API; confirm reconciliation in audit logs before treating results as production
              billing state.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["essential", "command", "enterprise_statewide", "rc_lite"] as SubscriptionPlanId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={!canManage || planMut.isPending}
                  onClick={() =>
                    planMut.mutate({ targetPlanId: id, effective: "period_end" })
                  }
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-40"
                >
                  Schedule → {id}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recent invoices
            </h2>
            {(p.invoices ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No invoices recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {p.invoices.slice(0, 10).map((inv) => (
                  <li
                    key={inv.invoiceId}
                    className="rounded-md border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-500">
                        {inv.invoiceId}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                          inv.state === "paid"
                            ? "bg-emerald-950 text-emerald-300"
                            : inv.state === "overdue"
                              ? "bg-rose-950 text-rose-300"
                              : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {inv.state}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      ${(inv.totalCents / 100).toLocaleString()} · due {inv.dueDate}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
              Cancel subscription (period end)
            </h2>
            <button
              type="button"
              disabled={!canManage || cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
              className="mt-3 rounded-md border border-amber-800/60 bg-amber-950/50 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-950/70 disabled:opacity-50"
            >
              Request cancel at period end
            </button>
          </section>
        </>
      )}
    </div>
  );
}
