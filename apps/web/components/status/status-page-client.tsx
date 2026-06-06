"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status/status-badge";
import { OPERATIONAL_HEADLINE, STATUS_LABELS } from "@/components/status/status-ui-copy";
import { STATUS_POLL_INTERVAL_MS } from "@/components/status/status-constants";
import { formatUtcTimestamp } from "@/lib/rapid-cortex/status/format-utc-timestamp";
import { groupStatusComponents } from "@/lib/rapid-cortex/status/component-groups";
import type { PublicStatusPayload } from "@/lib/rapid-cortex/status/public-status-payload";
import type { StatusComponent } from "@/lib/rapid-cortex/status/status-types";

function overallHeadline(overallStatus: PublicStatusPayload["overallStatus"]) {
  if (overallStatus === "operational") return OPERATIONAL_HEADLINE;
  return STATUS_LABELS[overallStatus];
}

function summaryOverallValue(overallStatus: PublicStatusPayload["overallStatus"]) {
  if (overallStatus === "operational") return "Operational";
  return STATUS_LABELS[overallStatus];
}

function ServiceRow({ component }: { component: StatusComponent }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-800/80 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100">{component.name}</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-400">{component.description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
        <StatusBadge status={component.status} variant="dot-text" />
        <time
          className="font-mono text-[11px] text-slate-500"
          dateTime={component.updatedAt}
        >
          {formatUtcTimestamp(component.updatedAt)}
        </time>
      </div>
    </div>
  );
}

type StatusPageClientProps = {
  initial: PublicStatusPayload;
};

export function StatusPageClient({ initial }: StatusPageClientProps) {
  const [data, setData] = useState<PublicStatusPayload>(initial);
  const [lastSuccessIso, setLastSuccessIso] = useState(initial.lastUpdated);
  const [fetchError, setFetchError] = useState(false);
  const [utcNow, setUtcNow] = useState(() => new Date());

  useEffect(() => {
    const clock = window.setInterval(() => setUtcNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/public/status", { cache: "no-store" });
        if (!res.ok) throw new Error("status_failed");
        const body = (await res.json()) as PublicStatusPayload;
        if (!body?.ok || cancelled) return;
        setData(body);
        setLastSuccessIso(body.lastUpdated);
        setFetchError(false);
      } catch {
        if (!cancelled) setFetchError(true);
      }
    }
    const timer = window.setInterval(poll, STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const grouped = groupStatusComponents(data.components);
  const headline = overallHeadline(data.overallStatus);
  const activeCount = data.activeIncidents.length;
  const maintenanceCount = data.scheduledMaintenance.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 sm:px-6 lg:gap-8 lg:py-11">
      <header className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/70 p-5 shadow-lg shadow-black/20 sm:p-6 md:p-7">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-sky-300/95">
          RAPID CORTEX STATUS
        </p>
        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-xl">
            <h1 className="text-[1.65rem] font-semibold tracking-tight text-white sm:text-4xl md:text-[2.125rem]">
              System Status
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-[15px]">
              Public operational status for Rapid Cortex services.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 sm:max-w-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white">{headline}</span>
              <StatusBadge status={data.overallStatus} variant="pill-md" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/90" aria-hidden />
                Refreshes every 3 minutes
              </span>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <time className="font-mono text-slate-300" dateTime={utcNow.toISOString()}>
                {formatUtcTimestamp(utcNow)}
              </time>
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Status summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/35 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Overall</p>
          <p className="mt-1.5 text-lg font-semibold text-white">{summaryOverallValue(data.overallStatus)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {activeCount === 0 ? "No active incidents" : `${activeCount} active incident(s)`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/35 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Active Incidents</p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-white">{activeCount}</p>
          <p className="mt-1 text-xs text-slate-400">Currently reported</p>
        </div>
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/35 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Maintenance</p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-white">{maintenanceCount}</p>
          <p className="mt-1 text-xs text-slate-400">Scheduled windows</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-800/90 bg-slate-900/35 p-5 md:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Last refresh</p>
          <p className="mt-1.5 truncate font-mono text-sm font-medium text-white">
            {formatUtcTimestamp(lastSuccessIso)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Updates every 3 minutes</p>
        </div>
      </section>

      <section aria-labelledby="svc-heading" className="space-y-4">
        <h2 id="svc-heading" className="text-base font-semibold text-white md:text-lg">
          Service components
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map(({ group: g, components: items, groupStatus }) => (
            <article
              key={g.id}
              className="rounded-2xl border border-slate-800/90 bg-slate-900/30 px-5 py-4 shadow-sm shadow-black/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-3 border-b border-slate-800/70 pb-3">
                <h3 className="text-sm font-semibold leading-snug text-slate-100">{g.title}</h3>
                <StatusBadge status={groupStatus} variant="pill-sm" />
              </div>
              <div className="pt-1">
                {items.map((c) => (
                  <ServiceRow key={c.id} component={c} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/30 px-5 py-5">
        <h2 className="text-base font-semibold text-white md:text-lg">Active Incidents</h2>
        {data.activeIncidents.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">No active incidents.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.activeIncidents.map((incident) => (
              <li key={incident.id} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{incident.title}</h3>
                  <span className="inline-flex rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-100">
                    {incident.severity}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-700/90 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                    {incident.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{incident.summary}</p>
                <p className="mt-2 font-mono text-[11px] text-slate-500">
                  Started: {formatUtcTimestamp(incident.startedAt)}
                </p>
                <ul className="mt-3 space-y-2 border-t border-slate-800/60 pt-3">
                  {incident.updates.map((update) => (
                    <li key={update.id} className="rounded-lg bg-slate-900/45 p-3 text-sm text-slate-300">
                      <p>{update.message}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">
                        {formatUtcTimestamp(update.timestamp)} — {update.status}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/30 px-5 py-5">
        <h2 className="text-base font-semibold text-white md:text-lg">Scheduled Maintenance</h2>
        {data.scheduledMaintenance.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">No scheduled maintenance.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.scheduledMaintenance.map((maintenance) => (
              <li key={maintenance.id} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{maintenance.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{maintenance.summary}</p>
                <p className="mt-2 font-mono text-[11px] text-slate-500">
                  {formatUtcTimestamp(maintenance.scheduledStart)} — {formatUtcTimestamp(maintenance.scheduledEnd)}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  Affected: {maintenance.affectedComponents.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/30 px-5 py-5">
        <h2 className="text-base font-semibold text-white md:text-lg">Incident History — Past 90 Days</h2>
        {data.incidentHistory.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">No incidents reported in the past 90 days.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.incidentHistory.map((incident) => (
              <li key={incident.id} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{incident.title}</h3>
                <p className="mt-1 text-sm text-slate-300">{incident.summary}</p>
                <p className="mt-2 font-mono text-[11px] text-slate-500">
                  Started: {formatUtcTimestamp(incident.startedAt)}
                  {incident.resolvedAt ? ` · Resolved: ${formatUtcTimestamp(incident.resolvedAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/30 px-5 py-5">
        <h2 className="text-base font-semibold text-white md:text-lg">Uptime Statistics</h2>
        {data.uptime.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">
            Public uptime tracking begins after production monitoring is connected.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.uptime.map((metric) => (
              <li
                key={`${metric.componentId}-${metric.periodDays}`}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4"
              >
                <p className="text-sm font-medium text-slate-100">{metric.componentName}</p>
                <p className="text-xs text-slate-300">
                  {metric.periodDays} days: {metric.uptimePercentage.toFixed(3)}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className={[
          "rounded-2xl border border-slate-800/90 bg-slate-950/50 px-5 py-5 text-sm leading-relaxed text-slate-300",
          "pb-[max(env(safe-area-inset-bottom,0px),1.25rem)]",
        ].join(" ")}
        aria-live="polite"
      >
        <p>
          Last status refresh:{" "}
          <span className="font-medium text-white">{formatUtcTimestamp(lastSuccessIso)}</span>
        </p>
        <p className="mt-2">
          Current UTC time:{" "}
          <span className="font-medium text-white">{formatUtcTimestamp(utcNow)}</span>
        </p>
        <p className="mt-2 text-slate-400">Status data refreshes every 3 minutes.</p>
        {fetchError ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
            Unable to refresh status data. Showing the most recent available status.
          </p>
        ) : null}
      </section>

      <footer className="pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] text-center text-xs text-slate-500">
        Rapid Cortex by Apps On Demand
      </footer>
    </div>
  );
}
