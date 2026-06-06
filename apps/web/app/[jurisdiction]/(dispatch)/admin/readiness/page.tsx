"use client";

import { useEffect, useState } from "react";
import { PlanBadge } from "@/components/rapid-cortex/feature-gates";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";
import type { FeatureReadinessResult } from "@/lib/rapid-cortex/readiness";

const STATE_LABEL: Record<FeatureReadinessResult["state"], string> = {
  ready: "Ready",
  configuration_required: "Configuration required",
  blocked: "Blocked",
  disabled: "Disabled",
  addon_not_enabled: "Add-on not enabled",
};

export default function AdminReadinessPage() {
  const [agencyConfig, setAgencyConfig] = useState<AgencyFeatureConfig | null>(null);
  const [items, setItems] = useState<FeatureReadinessResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/readiness", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ agencyConfig: AgencyFeatureConfig; items: FeatureReadinessResult[] }>;
      })
      .then((d) => {
        setAgencyConfig(d.agencyConfig);
        setItems(d.items);
      })
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : "Failed to load");
      });
  }, []);

  if (err) {
    return (
      <div className="m-4 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-100">
        {err}
      </div>
    );
  }
  if (!items || !agencyConfig) {
    return (
      <div className="m-4 text-sm text-slate-400">Loading deployment readiness…</div>
    );
  }

  return (
    <div className="m-4 max-w-5xl space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-100">Configuration readiness</h1>
          <PlanBadge plan={agencyConfig.plan} />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Server-side environment snapshot and entitlement gate per feature. Does not assert live CAD
          connectivity when credentials are absent.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Feature</th>
              <th className="px-3 py-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.featureId} className="border-b border-slate-800/60">
                <td className="px-3 py-2 align-top text-slate-200">{STATE_LABEL[row.state]}</td>
                <td className="px-3 py-2 align-top text-slate-200">
                  <p className="font-medium text-slate-100">{row.label}</p>
                  <p className="text-xs text-slate-500">{row.shortDescription}</p>
                  {row.missing.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-200/80">
                      Missing: {row.missing.join(", ")}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top text-xs text-slate-400">{row.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
