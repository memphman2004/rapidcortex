"use client";

import { useCallback, useEffect, useState } from "react";
import type { PricingAuditRecord, TenantPricingSummary } from "@/lib/pricing/pricing-types";
import { deleteTenantPricing, fetchPricingAudit } from "@/lib/pricing/pricing-api";

type PricingAuditTabProps = {
  tenants: TenantPricingSummary[];
  onSelectTenant: (agencyId: string) => void;
  onTenantsRefresh: () => Promise<void>;
  canEdit?: boolean;
};

const tableClass = "w-full border-collapse text-sm text-slate-200";
const thClass =
  "border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const tdClass = "border border-slate-700 px-3 py-2 align-top";

function formatMoney(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function PricingAuditTab({
  tenants,
  onSelectTenant,
  onTenantsRefresh,
  canEdit = false,
}: PricingAuditTabProps) {
  const [records, setRecords] = useState<PricingAuditRecord[]>([]);
  const [nextBefore, setNextBefore] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState<string | null>(null);

  const loadAudit = useCallback(async (before?: string) => {
    setLoading(true);
    try {
      const data = await fetchPricingAudit({ limit: 25, before });
      setRecords((prev) => (before ? [...prev, ...data.records] : data.records));
      setNextBefore(data.nextBefore);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  async function handleRevertAll(agencyId: string, agencyName: string) {
    const ok = window.confirm(
      `Revert all pricing overrides for ${agencyName}? This cannot be undone without re-entering values.`,
    );
    if (!ok) return;
    await deleteTenantPricing(agencyId, `Revert all overrides for ${agencyName}`);
    setConfirmRevert(null);
    await onTenantsRefresh();
    await loadAudit();
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white">Active tenant overrides</h3>
        <table className={tableClass} style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className={thClass}>Agency</th>
              <th className={thClass}>Plan</th>
              <th className={thClass}>Overrides</th>
              <th className={thClass}>Last changed</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${tdClass} text-slate-500`}>
                  No tenant-specific pricing overrides.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.agencyId}>
                  <td className={tdClass}>{t.agencyName}</td>
                  <td className={tdClass}>{t.plan ?? "—"}</td>
                  <td className={tdClass}>{t.overrideCount}</td>
                  <td className={tdClass}>
                    {t.lastModifiedAt
                      ? new Date(t.lastModifiedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => onSelectTenant(t.agencyId)}
                      >
                        View
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                          onClick={() => setConfirmRevert(t.agencyId)}
                        >
                          Revert all
                        </button>
                      ) : null}
                    </div>
                    {canEdit && confirmRevert === t.agencyId && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-red-400 underline"
                          onClick={() => void handleRevertAll(t.agencyId, t.agencyName)}
                        >
                          Confirm revert
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-500"
                          onClick={() => setConfirmRevert(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white">Change log</h3>
        <table className={tableClass} style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className={thClass}>Scope</th>
              <th className={thClass}>When</th>
              <th className={thClass}>Actor</th>
              <th className={thClass}>Reason</th>
              <th className={thClass}>Changes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className={tdClass}>
                  {r.scope === "global" ? (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                      Global
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      {r.tenantName ?? r.tenantId}
                    </span>
                  )}
                </td>
                <td className={tdClass}>{new Date(r.ts).toLocaleString()}</td>
                <td className={tdClass}>{r.actorEmail ?? r.actor}</td>
                <td className={tdClass}>{r.reason}</td>
                <td className={`${tdClass} text-xs text-slate-400`}>
                  {r.changes.map((c: { key: string; from: number; to: number }) => (
                    <div key={`${r.id}-${c.key}`}>
                      {c.key}: {formatMoney(c.from)} → {formatMoney(c.to)}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nextBefore && (
          <button
            type="button"
            disabled={loading}
            className="mt-4 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            onClick={() => void loadAudit(nextBefore)}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </div>
  );
}
