"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchApiHealth, fetchPlatformSummary } from "@/lib/api";
import { DashboardIntegrationHealth } from "./dashboard-integration-health";
import { RcAdminDashboardAlerts } from "./rc-admin-live-dashboard";

/** rcitadmin infrastructure home widgets — spec section 1. */
export function RcItAdminInfrastructureHome() {
  const healthQ = useQuery({ queryKey: ["api", "health"], queryFn: fetchApiHealth });
  const summaryQ = useQuery({
    queryKey: ["platform", "summary"],
    queryFn: fetchPlatformSummary,
    retry: false,
  });

  const pilot = summaryQ.data?.integrationSnapshot?.pilotReadiness;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">API status</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {healthQ.data?.status ?? (healthQ.isLoading ? "…" : "—")}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {healthQ.data?.deploymentStage ? `Stage ${healthQ.data.deploymentStage}` : "Upstream probe"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Tenants</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {summaryQ.data?.totals.agencies ?? (summaryQ.isLoading ? "…" : "—")}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Agencies in platform</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Onboarding blockers</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {summaryQ.data?.totals.agenciesWithOnboardingBlockers ?? (summaryQ.isLoading ? "…" : "—")}
          </p>
          <Link href="/rc-admin/onboarding" className="mt-1 inline-block text-[11px] text-cyan-400 hover:underline">
            View pipeline →
          </Link>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">STT / multilingual</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {pilot ? pilot.multilingualIssueCount : summaryQ.isLoading ? "…" : "—"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Open configuration issues</p>
        </div>
      </div>

      <RcAdminDashboardAlerts />

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-xs font-semibold text-slate-400">Integration status</p>
        <div className="mt-3">
          <DashboardIntegrationHealth prefix="rc-admin" />
        </div>
      </div>
    </div>
  );
}
