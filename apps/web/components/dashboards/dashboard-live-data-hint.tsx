"use client";

import { isApiConfigured } from "@/lib/api";
import {
  isOfflineDemoDataEnabled,
  isSlaBacklogEnabled,
} from "@/lib/runtime-flags";

type DashboardLiveDataHintProps = {
  /** When set, mentions this feature flag in the hint. */
  feature?: "sla";
};

export function DashboardLiveDataHint({ feature }: DashboardLiveDataHintProps) {
  if (feature === "sla") {
    if (!isSlaBacklogEnabled()) {
      return (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          SLA backlog is disabled. Set <code className="text-amber-100">NEXT_PUBLIC_ENABLE_SLA_BACKLOG=1</code>{" "}
          and configure <code className="text-amber-100">NEXT_PUBLIC_AUTH_PROXY</code> or{" "}
          <code className="text-amber-100">NEXT_PUBLIC_API_BASE</code> for live SLA data.
        </p>
      );
    }
    if (!isApiConfigured()) {
      return (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          API base is not configured. Set auth proxy or API base env vars for live SLA metrics.
          {isOfflineDemoDataEnabled()
            ? " Offline demo mode can still show sample incidents on the dispatch workspace."
            : null}
        </p>
      );
    }
    return null;
  }

  if (isApiConfigured()) return null;

  return (
    <p className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
      Preview metrics use mock data until{" "}
      <code className="text-slate-300">NEXT_PUBLIC_AUTH_PROXY=1</code> (recommended) or{" "}
      <code className="text-slate-300">NEXT_PUBLIC_API_BASE</code> is set.
      {isOfflineDemoDataEnabled()
        ? " Dispatch workspace can use offline demo incidents when the API is unreachable."
        : null}
    </p>
  );
}
