"use client";

import Link from "next/link";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";
import {
  getFeatureAvailability,
  isFeatureEnabledForAgency,
} from "@/lib/rapid-cortex/entitlements";
import { getRapidCortexFeatureById } from "@/lib/rapid-cortex/features";

export function PlanBadge({ plan }: { plan: AgencyFeatureConfig["plan"] }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
      {plan}
    </span>
  );
}

export function AddOnBadge() {
  return (
    <span className="rounded border border-sky-500/35 bg-sky-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-200/95">
      Add-on
    </span>
  );
}

export function LimitedBadge() {
  return (
    <span className="rounded border border-amber-500/35 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/95">
      Limited
    </span>
  );
}

export function UpgradeOrContactSalesCTA({
  label = "Contact Support to enable this add-on",
}: {
  label?: string;
}) {
  return (
    <Link
      href="/contact"
      className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-950/30 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-900/35"
    >
      {label}
    </Link>
  );
}

export function FeatureUnavailableState({
  title,
  body,
  showContactSales = false,
}: {
  title: string;
  body: string;
  showContactSales?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 text-sm text-slate-300">
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-slate-400">{body}</p>
      {showContactSales ? (
        <div className="mt-3">
          <UpgradeOrContactSalesCTA />
        </div>
      ) : null}
    </div>
  );
}

export function FeatureGate({
  agencyConfig,
  featureId,
  children,
  limitedFallback,
  unavailableFallback,
}: {
  agencyConfig: AgencyFeatureConfig;
  featureId: string;
  children: React.ReactNode;
  limitedFallback?: React.ReactNode;
  unavailableFallback?: React.ReactNode;
}) {
  const feature = getRapidCortexFeatureById(featureId);
  if (!feature) {
    return (
      <FeatureUnavailableState
        title="Feature registry mismatch"
        body={`Feature '${featureId}' is not registered.`}
      />
    );
  }

  const availability = getFeatureAvailability(agencyConfig.plan, featureId);
  const enabled = isFeatureEnabledForAgency(agencyConfig, featureId);

  if (enabled) {
    if (availability === "limited" && limitedFallback) {
      return <>{limitedFallback}</>;
    }
    return <>{children}</>;
  }

  if (availability === "add_on") {
    return (
      <>
        {unavailableFallback ?? (
          <FeatureUnavailableState
            title={`${feature.label} is available as an add-on`}
            body="This workflow is not enabled for this account. Contact Support to scope this capability for your agency."
            showContactSales
          />
        )}
      </>
    );
  }

  if (availability === "limited" && limitedFallback) {
    return <>{limitedFallback}</>;
  }

  return (
    <>
      {unavailableFallback ?? (
        <FeatureUnavailableState
          title={`${feature.label} is not available`}
          body="This workflow is currently disabled for this agency configuration."
        />
      )}
    </>
  );
}
