"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSlaBacklog, isSlaApiConfigured } from "@/lib/sla-api";
import { isSlaBacklogEnabled } from "@/lib/runtime-flags";

function metricClass(level: "ok" | "warn" | "bad"): string {
  if (level === "bad") return "text-rose-300";
  if (level === "warn") return "text-amber-300";
  return "text-emerald-300";
}

export function SlaStatusBar() {
  const enabled = isSlaBacklogEnabled() && isSlaApiConfigured();
  const q = useQuery({
    queryKey: ["sla-backlog"],
    queryFn: fetchSlaBacklog,
    enabled,
    refetchInterval: 30_000,
  });

  if (!enabled) return null;

  const snap = q.data;
  const breachLevel: "ok" | "warn" | "bad" =
    (snap?.slaBreachCount ?? 0) > 0 ? "bad" : (snap?.slaWarningCount ?? 0) > 0 ? "warn" : "ok";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Queue SLA</span>
        {q.isLoading ? <span className="text-slate-500">Loading…</span> : null}
        {q.isError ? (
          <span className="text-rose-300">{q.error instanceof Error ? q.error.message : "SLA unavailable"}</span>
        ) : null}
        {snap ? (
          <>
            <span>
              Depth{" "}
              <strong className={metricClass(snap.queueDepth > 8 ? "warn" : "ok")}>{snap.queueDepth}</strong>
            </span>
            <span>
              P1 <strong className={metricClass(snap.p1Count > 0 ? "warn" : "ok")}>{snap.p1Count}</strong>
            </span>
            <span>
              P2 <strong className="text-slate-200">{snap.p2Count}</strong>
            </span>
            <span>
              P3 <strong className="text-slate-200">{snap.p3Count}</strong>
            </span>
            <span>
              Avg wait{" "}
              <strong className={metricClass(snap.avgWaitSeconds > 60 ? "warn" : "ok")}>
                {snap.avgWaitSeconds}s
              </strong>
            </span>
            <span>
              Breaches <strong className={metricClass(breachLevel)}>{snap.slaBreachCount}</strong>
            </span>
            {snap.slaWarningCount > 0 ? (
              <span>
                Warnings <strong className="text-amber-300">{snap.slaWarningCount}</strong>
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
