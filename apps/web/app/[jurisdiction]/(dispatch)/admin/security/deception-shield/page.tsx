"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { fetchDeceptionEvents } from "@/lib/api";
import { isDeceptionShieldUiEnabled } from "@/lib/runtime-flags";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { useSession } from "@/components/auth/session-context";
import { isRcsuperadmin } from "rapid-cortex-shared";

type DeceptionRecord = Awaited<ReturnType<typeof fetchDeceptionEvents>>["items"][number];

function riskBadgeClass(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-red-950/70 text-red-100 ring-red-700/60";
    case "HIGH":
      return "bg-amber-950/60 text-amber-50 ring-amber-600/40";
    case "MEDIUM":
      return "bg-yellow-950/50 text-yellow-50 ring-yellow-700/35";
    default:
      return "bg-slate-800 text-slate-200 ring-slate-600/40";
  }
}

function partialMaskIp(ip: string): string {
  if (!ip) return ip;
  const p = ip.split(".");
  if (p.length === 4) return `${p[0]}.${p[1]}.x.x`;
  return ip.length > 12 ? `${ip.slice(0, 8)}…` : ip;
}

function recommendedAction(ev: DeceptionRecord): string {
  if (ev.eventType === "CROSS_CONTAMINATION")
    return "Escalate to security/IR; investigate session origin; consider credential rotation playbook review.";
  if (ev.eventType === "HONEYTOKEN_USED") {
    if (ev.riskLevel === "CRITICAL")
      return "Repeated honeytoken misuse; review IP/session for compromise; correlate with IAM and device posture.";
    return "Validate no production tokens echoed in logs or clients; tighten secret scanning CI and canary alerting.";
  }
  if (ev.riskLevel === "CRITICAL")
    return "Immediate analyst review — likely automated attack or APT-style sweep; prioritize WAF or edge blocking.";
  if (ev.riskLevel === "HIGH")
    return "Review IP reputation and CDN logs; tighten rate limits if repeated from same BGP prefix.";
  if (ev.riskLevel === "MEDIUM")
    return "Document in SOC queue; correlate with CDN/WAF anomalies over 24–72h.";
  return "Maintain watch; correlate with benign scanner noise vs. deliberate mapping.";
}

function DeceptionShieldContent() {
  const { user, isLoading: sessionLoading } = useSession();
  const enabled = useMemo(() => isDeceptionShieldUiEnabled(), []);
  const to = useJurisdictionLink();
  const qp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gateToast, setGateToast] = useState(false);

  useEffect(() => {
    const toast = qp.get("toast");
    if (!toast || toast !== "access_denied") return;
    setGateToast(true);
    router.replace(pathname, { scroll: false });
  }, [qp, pathname, router]);

  const allowed = !!(user && (isRcsuperadmin(user) || user.role === "agencyit" || user.role === "rcitadmin"));

  const qEvents = useQuery({
    queryKey: ["deception-events", enabled, allowed],
    queryFn: () => fetchDeceptionEvents({ limit: 800 }),
    enabled: enabled && allowed && !sessionLoading,
    staleTime: 30_000,
  });

  const items = useMemo(() => qEvents.data?.items ?? [], [qEvents.data?.items]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const aggregates = useMemo(() => {
    const now = nowMs;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let last24 = 0;
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const byRoute = new Map<string, number>();
    const byHour = new Map<string, number>();
    const ips = new Map<string, number>();
    let honeyUses = 0;

    const parseRisk = (r: string): keyof typeof counts => {
      if (r in counts) return r as keyof typeof counts;
      return "LOW";
    };

    for (const row of items) {
      const t = Date.parse(row.createdAt);
      if (!Number.isNaN(t)) {
        if (t >= dayAgo) {
          last24 += 1;
          const hr = `${new Date(Math.floor(t / 3_600_000) * 3_600_000).toISOString().slice(0, 13)}`;
          byHour.set(hr, (byHour.get(hr) ?? 0) + 1);
        }
        if (t >= weekAgo) {
          ips.set(row.sourceIp, (ips.get(row.sourceIp) ?? 0) + 1);
        }
      }

      counts[parseRisk(row.riskLevel)] += 1;
      const routeLabel = `${row.route}`.trim() || "(unknown)";
      byRoute.set(routeLabel, (byRoute.get(routeLabel) ?? 0) + 1);
      if (row.eventType === "HONEYTOKEN_USED") honeyUses += 1;
    }

    const topRoutes = [...byRoute.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topIps = [...ips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    const hourRows = [...byHour.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([h, count]) => ({ label: `${h}:00 UTC`, count }));

    const criticalRows = [...items].filter((e) => e.riskLevel === "CRITICAL").slice(0, 25);

    return {
      totals: counts,
      last24,
      topRoutes,
      topIps,
      hourRows,
      criticalRows,
      honeyUses,
      totalRows: items.length,
    };
  }, [items, nowMs]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-10 text-slate-200">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <ShieldAlert className="h-6 w-6 text-sky-400" aria-hidden /> Deception Shield
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Gate this UI explicitly with{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5 text-xs text-slate-300">
            NEXT_PUBLIC_ENABLE_DECEPTION_SHIELD_UI=1
          </code>{" "}
          for deployments that intentionally ship the deception admin API route.
        </p>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-400">
        Loading session<span className="motion-safe:animate-pulse"> …</span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Deception Shield</h1>
        <p className="mt-4 text-sm text-slate-400">
          This view is restricted to platform security administrators (Rapid Cortex).
        </p>
        <a href={to("/dashboard")} className="mt-6 inline-flex text-sm text-sky-400 hover:text-sky-300">
          Return to dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 text-slate-200">
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
          Detection &amp; response
        </p>
        <h1 className="text-2xl font-semibold text-white">Deception Shield observability</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
          This dashboard summarizes deception decoys plus honey-token detections on authenticated API paths.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          Telemetry rows originate only in DeceptionEvents, with sanitized header and payload fingerprints — never
          operational CJIS datasets.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Narration here reinforces SOC prioritization without implying investigative conclusions or deterministic
          attribution.
        </p>
      </header>

      {gateToast ? (
        <aside
          className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          Access denied — Rapid Cortex restricts this dashboard to Rapid Cortex administrators and delegated IT admins.
        </aside>
      ) : null}

      {qEvents.isError ? (
        <p className="rounded-md border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
          {qEvents.error instanceof Error ? qEvents.error.message : "Failed to load events"}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard title="Events (paginated chunk)" value={aggregates.totalRows} />
        <MetricCard title="Last 24h" value={aggregates.last24} />
        {(Object.keys(aggregates.totals) as Array<keyof typeof aggregates.totals>).map((k) => (
          <MetricCard key={k} title={k} value={aggregates.totals[k]} />
        ))}
      </section>

      <section className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-white">Recent CRITICAL events</h2>
        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Route</th>
                <th className="py-2 pr-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.criticalRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No CRITICAL events in this batch.Collect additional telemetry via higher API limits or CloudWatch if
                    required.
                  </td>
                </tr>
              ) : (
                aggregates.criticalRows.map((ev) => (
                  <Fragment key={ev.id}>
                    <tr
                      className="cursor-pointer border-t border-slate-800/70 hover:bg-slate-900/40"
                      onClick={() =>
                        setExpandedId((curr) => (curr === ev.id ? null : (ev.id as string)))
                      }
                    >
                      <td className="py-2 pr-3 font-mono text-[11px] text-slate-300">{ev.createdAt}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded px-2 py-0.5 ring-1 ${riskBadgeClass(ev.riskLevel)}`}>
                          {ev.eventType}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-[11px] text-emerald-200/90">
                          {ev.method} {ev.route}
                        </code>
                      </td>
                      <td className="py-2 pr-3">{partialMaskIp(ev.sourceIp)}</td>
                    </tr>
                    {expandedId === ev.id ? (
                      <tr className="bg-slate-900/35">
                        <td colSpan={4} className="px-2 py-4 text-[11px] text-slate-400">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <DetailBlock title="Correlation" body={ev.correlationId} />
                            <DetailBlock title="Recommendation" body={recommendedAction(ev)} />
                            <DetailBlock title="Headers summary" body={ev.headersSummary ?? "(none)"} />
                            <DetailBlock title="Payload summary" body={ev.payloadSummary ?? "(none)"} />
                            <DetailBlock title="Query summary" body={ev.querySummary ?? "(none)"} />
                            <DetailBlock title="Honeytoken" body={ev.honeytokenUsed ?? "—"} />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
          <h2 className="text-sm font-semibold text-white">Top IPs (rolling 7d from batch)</h2>
          <ul className="mt-4 space-y-2 text-xs">
            {aggregates.topIps.length === 0 ? (
              <li className="text-slate-500">No IP statistics available for this retrieval.</li>
            ) : (
              aggregates.topIps.map(([ip, n]) => (
                <li key={ip} className="flex justify-between rounded bg-slate-900/35 px-2 py-1">
                  <span className="font-mono">{partialMaskIp(ip)}</span>
                  <span className="text-slate-300">{n} hits</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
          <h2 className="text-sm font-semibold text-white">Honeytoken usage ({aggregates.honeyUses})</h2>
          <ul className="mt-4 max-h-48 space-y-2 overflow-auto text-[11px]">
            {[...items].filter((e) => e.eventType === "HONEYTOKEN_USED").length === 0 ? (
              <li className="text-slate-500">None in this retrieval.</li>
            ) : (
              [...items]
                .filter((e) => e.eventType === "HONEYTOKEN_USED")
                .slice(0, 25)
                .map((ev) => (
                  <li key={ev.id} className="rounded bg-slate-900/35 px-2 py-1">
                    <div className="font-medium text-amber-200/90">{ev.honeytokenUsed ?? "TOKEN"}</div>
                    <div className="text-slate-500">
                      {ev.createdAt} · {partialMaskIp(ev.sourceIp)} · {ev.method} {ev.route}
                    </div>
                  </li>
                ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-white">Top decoy routes (bar proportion)</h2>
        <div className="mt-6 space-y-3">
          {aggregates.topRoutes.length === 0 ? (
            <p className="text-xs text-slate-500">No route frequency data.</p>
          ) : (
            (() => {
              const max = Math.max(...aggregates.topRoutes.map(([, v]) => v), 1);
              return aggregates.topRoutes.map(([route, count]) => (
                <div key={route} className="space-y-1">
                  <div className="flex justify-between gap-4 text-[11px]">
                    <code className="truncate text-emerald-200/90">{route}</code>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-900">
                    <div
                      className="h-full rounded bg-gradient-to-r from-emerald-800 to-sky-700"
                      style={{ width: `${Math.round((count / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-white">Timeline (approximate hourly buckets, last 24h)</h2>
        <div className="mt-4 flex flex-wrap items-end gap-1">
          {aggregates.hourRows.length === 0 ? (
            <p className="text-xs text-slate-500">
              Extend repository batch sizing server-side under sustained load.Buckets may read empty whenever deception is
              disabled in an environment or when no events have persisted yet for the queried window.
            </p>
          ) : (
            (() => {
              const peaks = Math.max(...aggregates.hourRows.map((h) => h.count), 1);
              return aggregates.hourRows.map((h) => (
                <div key={h.label} className="flex w-[28px] flex-col items-center gap-1">
                  <div className="w-full rounded bg-slate-900/80 px-px">
                    <div
                      title={`${h.label}: ${h.count}`}
                      className="min-h-[24px] w-full rounded bg-sky-800/70"
                      style={{
                        height: `${Math.max(8, Math.round((h.count / peaks) * 56))}px`,
                      }}
                    />
                  </div>
                  <span className="-rotate-90 text-[9px] text-slate-600">{h.label.slice(11, 16)}</span>
                </div>
              ));
            })()
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard(props: { title: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{props.title}</div>
      <div className="mt-1 font-mono text-lg text-white">{props.value}</div>
    </div>
  );
}

function DetailBlock(props: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{props.title}</div>
      <div className="whitespace-pre-wrap break-words text-slate-300">{props.body}</div>
    </div>
  );
}

export default function DeceptionShieldPage() {
  return (
    <Suspense fallback={<div className="px-4 py-10 text-center text-sm text-slate-400">Loading …</div>}>
      <DeceptionShieldContent />
    </Suspense>
  );
}
