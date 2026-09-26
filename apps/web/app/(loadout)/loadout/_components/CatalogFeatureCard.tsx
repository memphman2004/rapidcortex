"use client";

import type { LoadoutFeature } from "rapid-cortex-shared/loadout";

interface CatalogFeatureCardProps {
  feature: LoadoutFeature;
  isActive?: boolean;
  onAdd?: (featureId: string) => void;
  onEnterprise?: (featureId: string) => void;
}

function formatCents(cents: number | null): string {
  if (cents === null) return "Custom";
  return `$${(cents / 100).toFixed(0)}/mo`;
}

const CATEGORY_COLORS: Record<string, string> = {
  core: "bg-sky-900/60 text-sky-300",
  intelligence: "bg-violet-900/60 text-violet-300",
  quality: "bg-emerald-900/60 text-emerald-300",
  field: "bg-orange-900/60 text-orange-300",
  automation: "bg-indigo-900/60 text-indigo-300",
  enterprise: "bg-amber-900/60 text-amber-300",
};

export function CatalogFeatureCard({ feature, isActive, onAdd, onEnterprise }: CatalogFeatureCardProps) {
  const catColor = CATEGORY_COLORS[feature.category] ?? "bg-slate-700 text-slate-300";

  return (
    <div className={`rounded-lg border p-4 flex flex-col gap-3 ${
      isActive ? "border-violet-600 bg-violet-950/30" : "border-slate-700 bg-slate-900/50"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{feature.name}</h3>
          <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${catColor}`}>
            {feature.category}
          </span>
        </div>
        {isActive && (
          <span className="shrink-0 text-[10px] font-semibold bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded">
            ACTIVE
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed flex-1">{feature.description}</p>

      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <div>
          <p className="text-sm font-semibold text-white">{formatCents(feature.monthlyBaseCents)}</p>
          {feature.includedCalls !== null && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              {feature.includedCalls.toLocaleString()} calls included
            </p>
          )}
        </div>
        {!isActive && (
          feature.enterprise ? (
            <button
              onClick={() => onEnterprise?.(feature.id)}
              className="text-xs px-3 py-1.5 rounded border border-amber-600 text-amber-400 hover:bg-amber-900/40 transition-colors"
            >
              Contact Sales
            </button>
          ) : (
            <button
              onClick={() => onAdd?.(feature.id)}
              className="text-xs px-3 py-1.5 rounded bg-violet-700 text-white hover:bg-violet-600 transition-colors"
            >
              Add Feature
            </button>
          )
        )}
      </div>
    </div>
  );
}
