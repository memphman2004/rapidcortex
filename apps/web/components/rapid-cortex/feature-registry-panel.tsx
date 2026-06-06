"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeatureDetailPanel } from "@/components/rapid-cortex/feature-explanation-ui";
import { AddOnBadge, LimitedBadge, PlanBadge, UpgradeOrContactSalesCTA } from "@/components/rapid-cortex/feature-gates";
import { fetchFeatureRegistry, patchAgencyConfig } from "@/lib/rapid-cortex/contracts-client";
import { getFeatureAvailability } from "@/lib/rapid-cortex/entitlements";
import type { FeatureAvailability, RapidCortexFeature } from "@/lib/rapid-cortex/features";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";

type RegistryState = {
  agencyConfig: AgencyFeatureConfig;
  features: Array<RapidCortexFeature & { enabledForAgency: boolean }>;
};

function AvailabilityPill({ value }: { value: FeatureAvailability }) {
  if (value === "included") {
    return (
      <span className="rounded border border-emerald-500/30 bg-emerald-950/25 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
        Included
      </span>
    );
  }
  if (value === "limited") return <LimitedBadge />;
  if (value === "add_on") return <AddOnBadge />;
  return (
    <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
      Unavailable
    </span>
  );
}

function statusForFeature(agency: AgencyFeatureConfig, feature: RapidCortexFeature & { enabledForAgency: boolean }) {
  if (feature.enabledForAgency) {
    if (getFeatureAvailability(agency.plan, feature.id) === "limited") return "Enabled (limited)";
    return "Enabled";
  }
  if (getFeatureAvailability(agency.plan, feature.id) === "unavailable") return "Unavailable (plan)";
  if (getFeatureAvailability(agency.plan, feature.id) === "add_on" && !agency.enabledAddOns.includes(feature.id)) {
    return "Add-on not in contract";
  }
  if (agency.disabledFeatures.includes(feature.id)) return "Disabled by admin";
  if (
    (feature.id === "cad_assisted_writeback" || feature.id === "cad_automated_writeback") &&
    agency.cadIntegrationMode === "assisted_writeback" &&
    agency.writeBackEnabled &&
    agency.auditLoggingEnabled
  ) {
    if (agency.agencyApprovedCadWriteBack !== true) {
      return "Configuration required (CAD write-back approval)";
    }
  }
  return "Configuration required";
}

export function FeatureRegistryPanel() {
  const [state, setState] = useState<RegistryState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RapidCortexFeature | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    void fetchFeatureRegistry()
      .then((data) => setState(data as RegistryState))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetchFeatureRegistry()
      .then((data) => {
        if (!mounted) return;
        setState(data as RegistryState);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load feature registry");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleAgencyFeatureDisabled = async (featureId: string, shouldDisable: boolean) => {
    if (!state) return;
    setSaving(true);
    try {
      const next = { ...state.agencyConfig };
      const d = new Set(next.disabledFeatures);
      if (shouldDisable) d.add(featureId);
      else d.delete(featureId);
      await patchAgencyConfig({ disabledFeatures: Array.from(d) });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    if (!state) return [];
    const map = new Map<string, RegistryState["features"]>();
    for (const feature of state.features) {
      const list = map.get(feature.category) ?? [];
      list.push(feature);
      map.set(feature.category, list);
    }
    return Array.from(map.entries());
  }, [state]);

  if (error) {
    return (
      <div className="m-4 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="m-4 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
        Loading feature registry…
      </div>
    );
  }

  return (
    <div className="m-4 space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-100">Feature Entitlements</h1>
          <PlanBadge plan={state.agencyConfig.plan} />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Public plans are quote-based. This panel shows capability availability only and does not
          expose internal pricing. CAD write-back never enables without{" "}
          <code className="text-slate-300">agencyApprovedCadWriteBack</code>, audit logging, and
          dispatcher approval on each change.
        </p>
        <p className="mt-2 text-xs text-amber-200/80">
          Automated CAD write-back remains blocked in product defaults; configure only under explicit
          enterprise governance.
        </p>
      </div>

      {detail ? (
        <div className="max-w-2xl">
          <FeatureDetailPanel feature={detail} onClose={() => setDetail(null)} />
        </div>
      ) : null}

      {grouped.map(([category, features]) => (
        <section key={category} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {category.replaceAll("_", " ")}
          </h2>
          <div className="mt-3 space-y-2">
            {features.map((feature) => {
              const availability = feature.planAvailability[state.agencyConfig.plan];
              const status = statusForFeature(state.agencyConfig, feature);
              const isCadWrite =
                feature.id === "cad_assisted_writeback" || feature.id === "cad_automated_writeback";
              return (
                <div
                  key={feature.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100" title={feature.shortDescription}>
                      {feature.label}
                    </p>
                    <p className="text-xs text-slate-400">{feature.shortDescription}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => setDetail(feature)}
                        className="text-sky-300 hover:underline"
                      >
                        Open detail panel
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <AvailabilityPill value={availability} />
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                        {status}
                      </span>
                    </div>
                    {getFeatureAvailability(state.agencyConfig.plan, feature.id) === "add_on" &&
                    !state.agencyConfig.enabledAddOns.includes(feature.id) ? (
                      <UpgradeOrContactSalesCTA />
                    ) : null}
                    {isCadWrite && feature.id === "cad_automated_writeback" ? (
                      <span className="text-[10px] text-amber-200/80">Default blocked in product</span>
                    ) : null}
                    {availability !== "unavailable" &&
                    (availability !== "add_on" || state.agencyConfig.enabledAddOns.includes(feature.id)) ? (
                      <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-400">
                        <input
                          type="checkbox"
                          className="rounded border-slate-600"
                          checked={!state.agencyConfig.disabledFeatures.includes(feature.id)}
                          disabled={saving}
                          onChange={(e) => {
                            void toggleAgencyFeatureDisabled(feature.id, !e.target.checked);
                          }}
                        />
                        Not disabled
                      </label>
                    ) : null}
                    {isCadWrite ? (
                      <p className="max-w-xs text-right text-[10px] text-slate-500">
                        Write-back also requires environment CAD mode, write flags, and approvals—see
                        rollout notes.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
