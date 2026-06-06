"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { CategoryBadge, StatusBadge, UrgencyBadge } from "@/components/dispatch/badges";
import { formatRelativeOpened } from "@/lib/format";
import { WarRoomLauncher } from "@/components/command/war-room-launcher";
import { QaReviewIncidentBadge } from "@/components/dispatch/qa/qa-review-incident-badge";
import { fetchQaSessions, isApiConfigured } from "@/lib/api";
import { loadAuditEvents, loadIncidents } from "@/lib/queries";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";
import type { Incident, QASession } from "rapid-cortex-shared";

function isActiveIncident(i: Incident) {
  return i.status === "active" || i.status === "in_progress";
}

export function SupervisorWorkspace() {
  const to = useJurisdictionLink();
  const incidentsQuery = useQuery({
    queryKey: ["incidents"],
    queryFn: loadIncidents,
  });
  const auditQuery = useQuery({
    queryKey: ["audit-events", "supervisor", 40],
    queryFn: () => loadAuditEvents(40),
  });
  const qaSessionsQuery = useQuery({
    queryKey: ["qa-sessions"],
    queryFn: fetchQaSessions,
    enabled: isQaScoringEnabled() && isApiConfigured(),
  });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);
  const qaByIncident = useMemo(() => {
    const m = new Map<string, QASession[]>();
    for (const s of qaSessionsQuery.data ?? []) {
      const arr = m.get(s.incidentId) ?? [];
      arr.push(s);
      m.set(s.incidentId, arr);
    }
    return m;
  }, [qaSessionsQuery.data]);
  const audits = useMemo(() => auditQuery.data ?? [], [auditQuery.data]);

  const stats = useMemo(() => {
    const active = incidents.filter(isActiveIncident).length;
    const escalated = incidents.filter((i) => i.escalationFlag).length;
    const byCat = incidents.reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1;
      return acc;
    }, {});
    const total = incidents.length;
    const pressure =
      total === 0 ? 0 : Math.min(100, Math.round((active / Math.max(total, 1)) * 100));
    let pressureLabel = "steady";
    if (pressure >= 75) pressureLabel = "heavy";
    else if (pressure >= 40) pressureLabel = "elevated";

    return { total, active, escalated, byCat, pressure, pressureLabel };
  }, [incidents]);

  const escalatedIncidents = useMemo(
    () => incidents.filter((i) => i.escalationFlag).slice(0, 12),
    [incidents],
  );

  const monitorSlice = useMemo(() => incidents.slice(0, 6), [incidents]);

  const aiAlerts = useMemo(
    () => audits.filter((a) => a.type === "analysis.created").slice(0, 12),
    [audits],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Supervisor overview</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Queue snapshot, escalations, multi-incident shortcuts, and recent AI audit signals for
          your agency.
        </p>
        {isQaScoringEnabled() ? (
          <p className="mt-3 text-sm">
            <Link
              href={to("/supervisor/qa")}
              className="font-medium text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline"
            >
              Open QA review queue
            </Link>
            <span className="text-slate-500"> — structured scoring and supervisor notes.</span>
          </p>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open incidents" value={stats.total} hint="All statuses in queue" />
        <StatCard label="Active / in progress" value={stats.active} hint="Needs attention" />
        <StatCard label="Escalated" value={stats.escalated} hint="Flagged for review" />
        <StatCard
          label="Categories (top)"
          value={Object.keys(stats.byCat).length}
          hint={Object.entries(stats.byCat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ") || "—"}
        />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Queue pressure
            </h2>
            <p className="mt-1 max-w-xl text-xs text-slate-500">
              Heuristic from active share of open incidents — wire to CAD / telephony load later.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-white">{stats.pressure}%</div>
            <div className="text-[11px] capitalize text-slate-400">{stats.pressureLabel}</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${
              stats.pressure >= 75
                ? "bg-amber-500"
                : stats.pressure >= 40
                  ? "bg-sky-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${stats.pressure}%` }}
          />
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Active operators
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Presence and session telemetry will list signed-in dispatchers per agency. Placeholder
          until WebSocket or Cognito last-active hooks land.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-500">
          <li>— No live operator feed yet (presence not wired)</li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Escalated incidents
        </h2>
        {escalatedIncidents.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No escalated incidents right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {escalatedIncidents.map((i) => (
              <li key={i.incidentId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-300">{i.incidentId}</span>
                    <CategoryBadge value={i.category} />
                    <UrgencyBadge value={i.urgency} />
                    <QaReviewIncidentBadge sessions={qaByIncident.get(i.incidentId) ?? []} />
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-200">{i.title}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <WarRoomLauncher incident={i} />
                  <Link
                    href={`${to("/dashboard")}?incident=${encodeURIComponent(i.incidentId)}`}
                    className="rounded-md bg-slate-800 px-2 py-1 text-xs text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
                  >
                    Dispatch
                  </Link>
                  <Link
                    href={to(`/review/${encodeURIComponent(i.incidentId)}`)}
                    className="rounded-md bg-sky-900/40 px-2 py-1 text-xs text-sky-200 ring-1 ring-sky-800 hover:bg-sky-900/60"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Multi-incident monitor
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Quick jump to the live dashboard or formal review for the newest incidents.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {monitorSlice.length === 0 ? (
              <p className="text-sm text-slate-500">No incidents loaded.</p>
            ) : (
              monitorSlice.map((i) => (
                <div
                  key={i.incidentId}
                  className="rounded-md border border-slate-800 bg-slate-900/50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge value={i.status} />
                    <UrgencyBadge value={i.urgency} />
                    <QaReviewIncidentBadge sessions={qaByIncident.get(i.incidentId) ?? []} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-100">{i.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formatRelativeOpened(i.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <WarRoomLauncher incident={i} />
                    <Link
                      href={`${to("/dashboard")}?incident=${encodeURIComponent(i.incidentId)}`}
                      className="text-xs font-medium text-sky-400 hover:underline"
                    >
                      Live board
                    </Link>
                    <Link
                      href={to(`/review/${encodeURIComponent(i.incidentId)}`)}
                      className="text-xs font-medium text-sky-400 hover:underline"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent AI alerts
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            From audit log (<code className="text-slate-400">analysis.created</code>).
          </p>
          {aiAlerts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              {auditQuery.isLoading ? "Loading…" : "No AI analysis events yet."}
            </p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
              {aiAlerts.map((a) => {
                const details = a.details as {
                  analysisId?: string;
                  provider?: string;
                  usedFallback?: boolean;
                };
                return (
                  <li
                    key={a.eventId}
                    className="rounded-md border border-slate-800/80 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{new Date(a.createdAt).toLocaleString()}</span>
                      {a.incidentId ? (
                        <Link
                          href={to(`/review/${encodeURIComponent(a.incidentId)}`)}
                          className="font-mono text-sky-400 hover:underline"
                        >
                          {a.incidentId}
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      Provider:{" "}
                      <span className="text-slate-100">{String(details.provider ?? "—")}</span>
                      {details.usedFallback ? (
                        <span className="ml-2 rounded bg-amber-950/80 px-1.5 py-0.5 text-amber-200">
                          fallback
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}
