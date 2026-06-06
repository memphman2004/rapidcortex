"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserContext } from "rapid-cortex-shared";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import {
  runDashboardIntegrationChecks,
  type IntegrationCheckResult,
} from "@/lib/dashboards/dashboard-health-probes";

export function DashboardIntegrationHealth({
  prefix,
}: {
  prefix: DashboardPrefix;
  user?: UserContext;
}) {
  const [checks, setChecks] = useState<IntegrationCheckResult[] | null>(null);
  const [running, setRunning] = useState(true);

  const refresh = useCallback(async () => {
    setRunning(true);
    try {
      const results = await runDashboardIntegrationChecks(prefix);
      setChecks(results);
    } catch {
      setChecks(null);
    } finally {
      setRunning(false);
    }
  }, [prefix]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allOk = checks?.every((c) => c.ok) ?? false;

  return (
    <section
      className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60 p-4"
      style={{ borderTop: "3px solid var(--role-accent)" }}
      aria-label="Integration health"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Integration health</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cognito session, API Gateway, Lambda handlers, and DynamoDB for this workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={running}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {running ? "Checking…" : "Re-check"}
        </button>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {(checks ?? []).map((c) => (
          <li
            key={c.id}
            className={`rounded-md border px-3 py-2 text-xs ${
              c.ok
                ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-100"
                : "border-rose-900/50 bg-rose-950/20 text-rose-100"
            }`}
          >
            <span className="font-medium">{c.label}</span>
            <span className="mt-0.5 block font-mono text-[11px] opacity-90">{c.detail}</span>
          </li>
        ))}
      </ul>

      {checks && !running ? (
        <p
          className={`mt-3 text-xs ${allOk ? "text-emerald-400" : "text-amber-300"}`}
          role="status"
        >
          {allOk
            ? "All integration checks passed for this dashboard."
            : "One or more checks failed — verify deployment env vars and IAM before go-live."}
        </p>
      ) : null}
    </section>
  );
}
