"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-context";
import { isCommandIntelligenceEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

type CommandSummary = {
  total911Calls: number;
  totalNonEmergencyCalls: number;
  callAssistContainmentRate: number | null;
  callsByType: Record<string, number>;
  dispatcherWorkload: Record<string, number>;
  translationUsageByLanguage: Record<string, number>;
  repeatLocations?: Array<{
    address: string;
    callCount: number;
    dominantType?: string;
  }>;
};

async function loadSummary(): Promise<CommandSummary> {
  const res = await fetch("/api/command/summary?range=today", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load Command Intelligence");
  return res.json();
}

export default function CommandIntelligencePage() {
  const { user } = useSession();
  const enabled = isCommandIntelligenceEnabled();
  const q = useQuery({ queryKey: ["command-summary"], queryFn: loadSummary, enabled });

  if (!enabled) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Command Intelligence is not enabled for this deployment.
      </div>
    );
  }

  if (!isSupervisorOrStaffRole(user?.role) && user?.role !== "agencyadmin" && user?.role !== "analyst") {
    return <SupervisorAccessRestricted />;
  }

  const s = q.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Command Intelligence</h1>
        <p className="mt-1 text-sm text-slate-400">
          Communications operations metrics — not crime analysis or CompStat.
        </p>
      </header>

      {q.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : null}
      {q.isError ? <p className="text-sm text-red-400">Unable to load metrics.</p> : null}

      {s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="911 calls" value={String(s.total911Calls)} />
            <MetricCard label="Non-emergency" value={String(s.totalNonEmergencyCalls)} />
            <MetricCard
              label="Call Assist containment"
              value={
                s.callAssistContainmentRate == null
                  ? "—"
                  : `${Math.round(s.callAssistContainmentRate * 100)}%`
              }
            />
            <MetricCard
              label="Languages"
              value={String(Object.keys(s.translationUsageByLanguage).length)}
            />
          </div>

          <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Repeat locations
            </h2>
            {(s.repeatLocations?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No repeat locations in range.</p>
            ) : (
              <ul className="divide-y divide-slate-800 text-sm">
                {s.repeatLocations!.map((loc) => (
                  <li key={loc.address} className="flex justify-between gap-4 py-2">
                    <span className="truncate">{loc.address}</span>
                    <span className="shrink-0 text-slate-400">
                      {loc.callCount}
                      {loc.dominantType ? ` · ${loc.dominantType}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex gap-3">
            <a
              href="/api/command/export?range=today&format=csv"
              className="rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
            >
              Export CSV
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
