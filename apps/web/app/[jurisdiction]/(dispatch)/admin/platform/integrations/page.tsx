"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIntegrationStatus, fetchPlatformSummary } from "@/lib/api";
import { ProviderHealthCard } from "@/components/platform/provider-health-card";

export default function PlatformIntegrationsPage() {
  const integ = useQuery({ queryKey: ["integration", "status"], queryFn: fetchIntegrationStatus });
  const summary = useQuery({ queryKey: ["platform", "summary"], queryFn: fetchPlatformSummary });
  const p = integ.data?.pilotReadiness;
  const snapAgency = integ.data?.agencyId;
  const alt = summary.data?.integrationSnapshot;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Integrations & providers</h1>
        <p className="text-sm text-slate-400">
          Deployment status surface for the integration stack. The primary{" "}
          <span className="font-mono text-slate-500">/api/integration/status</span> call is scoped to
          sample agency <span className="font-mono">{snapAgency ?? "—"}</span>.
        </p>
      </div>

      {integ.isLoading ? (
        <p className="text-sm text-slate-500">Loading integration status…</p>
      ) : integ.isError ? (
        <p className="text-sm text-rose-300">Could not load integration status.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ProviderHealthCard
              title="Cognito & auth (implicit)"
              health="ok"
            >
              API uses Cognito JWT. Verify pool groups in AWS console. Platform summary mirrors deployment
              checks.
            </ProviderHealthCard>
            <ProviderHealthCard title="Transcript & CAD surface" health="ok">
              {String(integ.data?.transcriptSource ?? "—")} — {integ.data?.auditHint}
            </ProviderHealthCard>
            <ProviderHealthCard
              title="Dynamo & agency store"
              health="ok"
            >
              API reads from configured Dynamo tables. See deployment env for table names.
            </ProviderHealthCard>
            {p ? (
              <>
                <ProviderHealthCard
                  title="SMS & voice (Twilio / SNS paths)"
                  health="warn"
                >
                  Configure per deployment; this screen does not call carrier APIs. Combine with
                  comms runbooks.
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="SES & email"
                  health={p.multilingualStrictValidation ? "ok" : "warn"}
                >
                  Strict language validation: {p.multilingualStrictValidation ? "on" : "off"}
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="Live video / Kinesis (readiness)"
                  health={p.assetsBucketConfigured ? "ok" : "warn"}
                >
                  Assets bucket reported: {p.assetsBucketConfigured ? "yes" : "no"}. KVS / WebRTC stack
                  requires AWS console and incident smoke tests.
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="STT, translation, AI"
                  health={p.multilingualIssueCount > 0 ? "err" : "ok"}
                >
                  Issues: {p.multilingualIssueCount}. Translation: {p.multilingualPrimaryTranslation}
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="Transcript + AI analysis pipeline"
                  health="ok"
                >
                  {p.aiPrimaryProvider} / {p.aiSecondaryProvider} / {p.aiTertiaryProvider}
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="CAD connector"
                  health="ok"
                >
                  Surface via integration mode on each agency; not globally probed from this view.
                </ProviderHealthCard>
              </>
            ) : null}
          </div>

          {alt && (
            <section className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-500">
              <h2 className="font-medium text-slate-400">Platform summary snapshot (parallel)</h2>
              <p className="mt-1">Same build helper as main dashboard, agency {alt.agencyId}.</p>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-slate-600">
        Per-tenant and per-environment health tables are a next phase when the API exposes a matrix; use
        agency records and incident smoke tests in the meantime.
      </p>
    </div>
  );
}
