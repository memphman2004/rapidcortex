"use client";

import { useMemo } from "react";
import {
  ADDON_CATALOG,
  isAddonIncludedInPlan,
  type AddonDefinition,
} from "rapid-cortex-shared";
import { useAgencyEntitlements } from "@/lib/hooks/use-addon-entitlements";

function formatPrice(def: AddonDefinition): string {
  if (def.billingType === "monthly") return `$${def.monthlyPrice}/mo`;
  return `$${def.oneTimePrice} one-time`;
}

export function AgencyEntitlementsPanel() {
  const { data, isLoading, error } = useAgencyEntitlements();

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, AddonDefinition[]>();
    for (const def of data.catalog ?? ADDON_CATALOG) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return [...map.entries()];
  }, [data]);

  if (isLoading) return <p className="text-sm text-slate-400">Loading your feature entitlements…</p>;
  if (error || !data) {
    return <p className="text-sm text-amber-200">Could not load entitlements. Try again later.</p>;
  }

  const { entitlements } = data;
  const included = ADDON_CATALOG.filter((d) => isAddonIncludedInPlan(d, entitlements.plan));
  const activePaid = ADDON_CATALOG.filter((d) => {
    if (isAddonIncludedInPlan(d, entitlements.plan)) return false;
    return Boolean(entitlements.addons[d.key]?.enabled);
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Features & add-ons</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Read-only view of your agency plan and enabled capabilities. To change add-ons, contact your Rapid Cortex
          representative.
        </p>
        <p className="text-sm text-slate-300">
          Current plan: <span className="font-semibold text-sky-200">{entitlements.plan}</span>
        </p>
      </header>

      <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-200">Included in your plan</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {included.length === 0 ? (
            <li className="text-sm text-slate-400">No catalog features are marked plan-included for this tier.</li>
          ) : (
            included.map((d) => (
              <li
                key={d.key}
                className="rounded-full border border-emerald-800/60 bg-emerald-900/30 px-3 py-1 text-xs text-emerald-100"
              >
                ✓ {d.name}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-900/50 bg-sky-950/20 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-200">Active paid add-ons</h2>
        {activePaid.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No additional paid add-ons are enabled.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activePaid.map((d) => (
              <li key={d.key} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                <span>{d.name}</span>
                <span className="rounded bg-sky-900/40 px-2 py-0.5 text-xs text-sky-100">{formatPrice(d)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Full catalog</h2>
        {grouped.map(([category, addons]) => (
          <section key={category} className="overflow-hidden rounded-lg border border-slate-800">
            <div className="bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200">{category}</div>
            <ul className="divide-y divide-slate-800">
              {addons.map((def) => {
                const planIncluded = isAddonIncludedInPlan(def, entitlements.plan);
                const enabled = planIncluded || Boolean(entitlements.addons[def.key]?.enabled);
                return (
                  <li
                    key={def.key}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm ${
                      enabled ? "bg-slate-950/30 text-slate-200" : "bg-slate-950/10 text-slate-500"
                    }`}
                  >
                    <div className="min-w-[200px] flex-1">
                      <p className="font-medium">{def.name}</p>
                      <p className="text-xs opacity-80">{def.description}</p>
                    </div>
                    {planIncluded ? (
                      <span className="text-xs text-emerald-300">Included</span>
                    ) : enabled ? (
                      <span className="text-xs text-sky-300">{formatPrice(def)}</span>
                    ) : (
                      <span className="max-w-xs text-right text-xs italic text-slate-500">
                        Contact your Rapid Cortex representative to enable
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
