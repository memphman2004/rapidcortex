"use client";

import type { RapidCortexFeature, RapidCortexPlan } from "@/lib/rapid-cortex/features";
import { getRapidCortexFeatureById } from "@/lib/rapid-cortex/features";
import { AddOnBadge, LimitedBadge } from "@/components/rapid-cortex/feature-gates";
import type { FeatureAvailability } from "@/lib/rapid-cortex/features";

/** Hover/focus: shows registry shortDescription. Usable in pricing matrix, admin, and onboarding. */
export function FeatureExplanationTooltip({
  featureId,
  children,
  className = "",
}: {
  featureId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const f = getRapidCortexFeatureById(featureId);
  const title = f?.shortDescription ?? "";
  return (
    <span className={`group inline-flex max-w-full items-center gap-1 ${className}`}>
      <span className="min-w-0">{children}</span>
      {f ? (
        <>
          <span
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-600/80 text-[10px] font-semibold text-slate-500"
            title={title}
            aria-label={title}
          >
            i
          </span>
          <span className="sr-only">{title}</span>
        </>
      ) : null}
    </span>
  );
}

function PlanAvailabilityRow({ value }: { value: FeatureAvailability }) {
  if (value === "included") return <span className="text-emerald-200/95">Included</span>;
  if (value === "limited")
    return (
      <span className="inline-flex items-center gap-1">
        <LimitedBadge />
      </span>
    );
  if (value === "add_on")
    return (
      <span className="inline-flex items-center gap-1">
        <AddOnBadge />
      </span>
    );
  return <span className="text-slate-500">Unavailable</span>;
}

export function FeatureDetailPanel({ feature, onClose }: { feature: RapidCortexFeature; onClose?: () => void }) {
  const plans: RapidCortexPlan[] = ["essential", "professional", "command", "enterprise"];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-50">{feature.label}</h3>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-slate-300">{feature.shortDescription}</p>
      <div className="mt-3 space-y-2 text-slate-400">
        <p>
          <span className="font-semibold text-slate-300">Operators:</span> {feature.operatorExplanation}
        </p>
        <p>
          <span className="font-semibold text-slate-300">Admins:</span> {feature.adminExplanation}
        </p>
        <p>
          <span className="font-semibold text-slate-300">Sales / proposals:</span> {feature.salesExplanation}
        </p>
        <p>
          <span className="font-semibold text-slate-300">Rollout:</span> {feature.rolloutNotes}
        </p>
      </div>
      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="text-xs font-semibold uppercase text-slate-500">By plan</p>
        <ul className="mt-1 space-y-1 text-xs">
          {plans.map((p) => (
            <li key={p} className="flex justify-between gap-2">
              <span className="text-slate-500 capitalize">{p}</span>
              <PlanAvailabilityRow value={feature.planAvailability[p]} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
