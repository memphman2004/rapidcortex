"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "@/components/auth/session-context";
import {
  FeatureGate,
  LimitedBadge,
  PlanBadge,
  UpgradeOrContactSalesCTA,
} from "@/components/rapid-cortex/feature-gates";
import { deriveAgencyConfigFromUser } from "@/lib/rapid-cortex/agency-config";
import { getRapidCortexFeatureById } from "@/lib/rapid-cortex/features";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export function FeatureRoutePlaceholder({
  title,
  featureId,
  summary,
}: {
  title: string;
  featureId: string;
  summary: string;
}) {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const agencyConfig = useMemo(() => deriveAgencyConfigFromUser(user), [user]);
  const feature = getRapidCortexFeatureById(featureId);

  if (!feature) {
    return (
      <div className="m-4 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-100">
        Unknown feature id: {featureId}
      </div>
    );
  }

  return (
    <div className="m-4 rounded-xl border border-slate-800 bg-slate-900/35 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        <PlanBadge plan={agencyConfig.plan} />
      </div>
      <p className="text-sm text-slate-300">{summary}</p>
      <p className="mt-2 text-xs text-slate-400">
        Complete integration setup in{" "}
        <Link href={to("/admin/integrations")} className="text-sky-300 hover:text-sky-200">
          Admin → Integrations
        </Link>
        .
      </p>

      <div className="mt-4">
        <FeatureGate
          agencyConfig={agencyConfig}
          featureId={featureId}
          limitedFallback={
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
              <div className="mb-1 inline-flex">
                <LimitedBadge />
              </div>
              <p>
                This capability is available in limited mode for your plan. Contact your admin or
                sales team to expand scope.
              </p>
            </div>
          }
          unavailableFallback={
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-200">
              <p>
                This workflow is not currently enabled for your plan or account configuration.
              </p>
              <div className="mt-2">
                <UpgradeOrContactSalesCTA />
              </div>
            </div>
          }
        >
          <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm text-emerald-100">
            Feature is enabled for this agency configuration. If integration dependencies are still
            pending, complete setup in Admin → Integrations.
          </div>
        </FeatureGate>
      </div>
    </div>
  );
}
