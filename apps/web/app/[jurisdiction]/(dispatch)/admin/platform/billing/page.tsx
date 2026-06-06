"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchAgencies, fetchAgencyBillingProfile } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { useQueries } from "@tanstack/react-query";

export default function PlatformBillingPage() {
  const to = useJurisdictionLink();
  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const ids = (agenciesQ.data ?? []).map((a) => a.agencyId);

  const billings = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["billing", id],
      queryFn: () => fetchAgencyBillingProfile(id),
      enabled: Boolean(id),
    })),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Billing overview</h1>
        <p className="text-sm text-slate-400">
          One row per tenant. Fetches v1 <span className="font-mono">AgencyBillingProfile</span> when the
          billing API is enabled; failures are shown inline.
        </p>
      </div>

      {agenciesQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading agencies…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Agency</th>
                <th className="px-2 py-2">Pilot / paid</th>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Subscription</th>
                <th className="px-2 py-2">Account</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {(agenciesQ.data ?? []).map((a, i) => {
                const bq = billings[i];
                const error = bq?.isError;
                const p = bq?.data;
                const pilot = a.type === "pilot" || a.status === "pilot";
                return (
                  <tr key={a.agencyId} className="border-b border-slate-800/80">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-100">{a.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{a.agencyId}</div>
                    </td>
                    <td className="px-2 py-2 text-[11px]">{pilot ? "Pilot" : "Non-pilot"}</td>
                    <td className="px-2 py-2 text-[11px]">
                      {error ? "—" : p?.assignedPlanId ?? "unassigned"}
                    </td>
                    <td className="px-2 py-2 text-[11px]">
                      {error ? "—" : p?.subscription?.lifecycle ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px]">
                      {error ? "unavailable" : p?.billingAccount?.status}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={to(`/admin/billing/agency/${encodeURIComponent(a.agencyId)}`)}
                        className="text-sky-300 hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-600">
        Invoice PDFs, processor linkage, and contract renewals live on each agency detail page. This table is a cross-tenant
        index only.
      </p>
    </div>
  );
}
