"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAdminRole } from "rapid-cortex-security";
import { fetchApiHealth, fetchPlatformSummary } from "@/lib/api";
import { useSession } from "@/components/auth/session-context";
import { ProviderHealthCard } from "@/components/platform/provider-health-card";
import { StatCard } from "@/components/dashboards/stat-card";
import { ReportTable } from "@/components/reports/report-table";
import {
  downloadReportCsv,
  generateReport,
  isReportsApiConfigured,
  monthlySystemHealthReportName,
  previousCalendarMonthRange,
} from "@/lib/reports-api";
import { isReportsEnabled } from "@/lib/runtime-flags";
import type { ReportResult } from "rapid-cortex-shared";

function summaryValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export default function PlatformSystemHealthPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ["api", "health"], queryFn: fetchApiHealth });
  const platform = useQuery({ queryKey: ["platform", "summary"], queryFn: fetchPlatformSummary });
  const h = health.data;
  const s = platform.data;
  const canMonthly =
    Boolean(user?.agencyId) &&
    user != null &&
    isAdminRole(user.role) &&
    isReportsEnabled() &&
    isReportsApiConfigured();
  const month = previousCalendarMonthRange();
  const [monthlyBusy, setMonthlyBusy] = useState(false);
  const [monthlyErr, setMonthlyErr] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<ReportResult | null>(null);

  const generateMonthly = async () => {
    setMonthlyBusy(true);
    setMonthlyErr(null);
    try {
      const result = await generateReport({
        type: "system_health",
        name: monthlySystemHealthReportName(month.label),
        dateRange: { start: month.start, end: month.end },
      });
      setMonthly(result);
      await qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (e) {
      setMonthlyErr(e instanceof Error ? e.message : "Could not generate monthly report");
    } finally {
      setMonthlyBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">System health</h1>
        <p className="text-sm text-slate-400">
          Lightweight probes available to the web app. Deep infra (queues, Kinesis, X-Ray) belongs in
          CloudWatch and your ops playbooks.
        </p>
      </div>

      {canMonthly ? (
        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Monthly system health report</h2>
              <p className="mt-1 max-w-xl text-xs text-slate-500">
                Previous calendar month ({month.label}): device uptime, activation events, resolved
                incidents, and open issues. Saved under Reports and exportable as CSV.
              </p>
            </div>
            <button
              type="button"
              disabled={monthlyBusy}
              onClick={() => void generateMonthly()}
              className="rounded bg-sky-900/60 px-3 py-1.5 text-xs font-medium text-sky-100 ring-1 ring-sky-800 disabled:opacity-40"
            >
              {monthlyBusy ? "Generating…" : `Generate ${month.label}`}
            </button>
          </div>
          {monthlyErr ? <p className="text-sm text-rose-300">{monthlyErr}</p> : null}
          {monthly ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(monthly.summary).map(([key, val]) => (
                  <StatCard key={key} label={key.replace(/([A-Z])/g, " $1")} value={summaryValue(val)} />
                ))}
              </div>
              <ReportTable
                rows={monthly.rows}
                onExportCsv={() => void downloadReportCsv(monthly.reportId)}
              />
            </div>
          ) : null}
        </section>
      ) : null}

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
              This page does not send SMS. Use the integration view and AWS End User Messaging dashboards.
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
