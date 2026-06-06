"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AgencyBillingProfile, UserContext } from "rapid-cortex-shared";
import {
  fetchAgencyBillingProfile,
  fetchMonetizationSubscription,
  isApiConfigured,
  type MonetizationSubscriptionSnapshot,
} from "@/lib/api";

const TABS = [
  ["plan", "Current plan"],
  ["usage", "Usage"],
  ["invoices", "Invoices"],
  ["billing", "Procurement & billing refs"],
  ["addons", "Add-ons"],
  ["api", "API usage"],
] as const;

export function AgencyBillingPanel({ initialUser }: { initialUser: UserContext }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("plan");
  const [legacyProfile, setLegacyProfile] = useState<AgencyBillingProfile | null>(null);
  const [subscriptionSnap, setSubscriptionSnap] = useState<MonetizationSubscriptionSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    if (!isApiConfigured()) {
      setErr("API not configured — set NEXT_PUBLIC_API_BASE or NEXT_PUBLIC_AUTH_PROXY.");
      return;
    }
    try {
      const [p, m] = await Promise.all([
        fetchAgencyBillingProfile(initialUser.agencyId),
        fetchMonetizationSubscription(initialUser.agencyId),
      ]);
      setLegacyProfile(p);
      setSubscriptionSnap(m);
    } catch {
      setErr("Could not load billing information.");
    }
  }, [initialUser.agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing & entitlement</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Rapid Cortex is sold through agency contracts, approved pilots, purchase orders, invoices, and authorized
          procurement workflows. This view summarizes entitlement and internal reconciliation identifiers for your tenant.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/contact-sales"
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
          >
            Contact Support
          </Link>
          <Link
            href="/contact-sales"
            className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-200 hover:bg-slate-900"
          >
            Request procurement review
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
              tab === id ? "bg-sky-600 text-white shadow-sm shadow-sky-950/40" : "text-slate-400 hover:bg-slate-950/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {err ? <p className="text-sm text-amber-200">{err}</p> : null}

      {tab === "plan" && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-white">Current plan</h2>
          <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Legacy packaged plan</dt>
              <dd className="font-mono text-slate-200">
                {legacyProfile?.subscription?.planId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Monetization plan id</dt>
              <dd className="font-mono text-slate-200">{subscriptionSnap?.planId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Subscription status</dt>
              <dd className="font-mono text-slate-200">{subscriptionSnap?.subscriptionStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Billing status</dt>
              <dd className="font-mono text-slate-200">{subscriptionSnap?.billingStatus ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            To discuss pricing, pilot access, or procurement options, contact the Rapid Cortex team.
          </p>
        </section>
      )}

      {tab === "usage" && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          Usage counters sync from Dynamo metering. Contracted pilots and invoiced programs use these signals for capacity
          reviews and renewal planning—not public card billing.
        </section>
      )}

      {tab === "invoices" && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-white">Invoices</h2>
          <p className="mt-2 text-sm text-slate-400">
            Internal invoice artifacts cached for this tenant ({legacyProfile?.invoices?.length ?? 0} row
            {legacyProfile?.invoices?.length === 1 ? "" : "s"}). Official PDFs follow your agency&apos;s procurement
            path and Rapid Cortex finance operations.
          </p>
        </section>
      )}

      {tab === "billing" && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-300">
          <p>
            External billing customer id:{" "}
            <span className="font-mono text-slate-100">
              {subscriptionSnap?.externalBillingCustomerId ?? "not linked"}
            </span>
            . External subscription reference:{" "}
            <span className="font-mono text-slate-100">
              {subscriptionSnap?.externalBillingSubscriptionId ?? "not linked"}
            </span>
            .
          </p>
          <p className="mt-3 text-slate-400">
            Rapid Cortex does not process public self-service card payments. Align renewals with the purchase order and
            contracting package on file.
          </p>
        </section>
      )}

      {tab === "addons" && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          <p>
            View your plan-included and paid feature add-ons on the{" "}
            <Link href="/agency-admin/features" className="text-sky-400 hover:text-sky-300 hover:underline">
              Features & add-ons
            </Link>{" "}
            page (read-only). Legacy subscription add-on ids:{" "}
            <span className="font-mono text-slate-200">
              {subscriptionSnap?.addOnIds?.join(", ") || "none on file"}
            </span>
          </p>
        </section>
      )}

      {tab === "api" && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          Detailed per-client usage remains in <strong className="text-slate-200">Agency API</strong>; API throughput will
          appear here alongside webhook delivery metrics after metering aggregates sync.
        </section>
      )}
    </div>
  );
}
