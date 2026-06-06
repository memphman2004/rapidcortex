"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApiHealth, fetchPlatformSummary } from "@/lib/api";
import { ProviderHealthCard } from "@/components/platform/provider-health-card";

export default function PlatformSystemHealthPage() {
  const health = useQuery({ queryKey: ["api", "health"], queryFn: fetchApiHealth });
  const platform = useQuery({ queryKey: ["platform", "summary"], queryFn: fetchPlatformSummary });
  const h = health.data;
  const s = platform.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">System health</h1>
        <p className="text-sm text-slate-400">
          Lightweight probes available to the web app. Deep infra (queues, Kinesis, X-Ray) belongs in
          CloudWatch and your ops playbooks.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ProviderHealthCard
          title="HTTP API"
          health={
            h?.status === "ok" || h?.status === "healthy" ? "ok" : "unknown"
          }
        >
          {health.isLoading
            ? "…"
            : h
              ? `${h.service} — stage ${h.deploymentStage ?? "n/a"}${h.revision ? ` · ${h.revision}` : ""}`
              : "—"}
        </ProviderHealthCard>
        <ProviderHealthCard
          title="Live incidents (sample count)"
          health="ok"
        >
          {s ? `${s.totals.liveIncidents} open/active over sampled agencies` : "—"}
        </ProviderHealthCard>
        <ProviderHealthCard
          title="Auth (Cognito)"
          health="ok"
        >
          Not directly probed here — validate with Cognito metrics and test sign-in. User pool is configured
          per deployment.
        </ProviderHealthCard>
        <ProviderHealthCard
          title="Operators"
          health={s && s.totals.agenciesWithOnboardingBlockers > 0 ? "warn" : "ok"}
        >
          {s
            ? `${s.totals.onboardingItemsNeedingAttention} onboarding items, ${s.totals.agenciesWithOnboardingBlockers} with blockers.`
            : "—"}
        </ProviderHealthCard>
        {s?.integrationSnapshot.pilotReadiness ? (
          <>
            <ProviderHealthCard
              title="SMS / comms (readiness only)"
              health="warn"
            >
              This page does not dial Twilio. Use the integration view + carrier dashboards.
            </ProviderHealthCard>
            <ProviderHealthCard
              title="SES / email"
              health="ok"
            >
              See SES console for account status and domain verification.
            </ProviderHealthCard>
            <ProviderHealthCard
              title="Video / WebRTC / KVS"
              health={s.integrationSnapshot.pilotReadiness.assetsBucketConfigured ? "ok" : "warn"}
            >
              Media assets bucket:{" "}
              {s.integrationSnapshot.pilotReadiness.assetsBucketConfigured ? "reported" : "not set"} in pilot
              readiness.
            </ProviderHealthCard>
            <ProviderHealthCard
              title="Background work / queues"
              health="unknown"
            >
              Job depth is not exposed via this app yet. Check SQS / Lambda failure metrics in AWS.
            </ProviderHealthCard>
            <ProviderHealthCard
              title="Recent risk signals (platform summary)"
              health={s.totals.agenciesWithOnboardingBlockers > 0 ? "err" : "ok"}
            >
              Multilingual issues: {s.integrationSnapshot.pilotReadiness.multilingualIssueCount}
            </ProviderHealthCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
