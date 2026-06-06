"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchIntegrationStatus,
  isApiConfigured,
  type IntegrationStatusPayload,
} from "@/lib/api";
import {
  filterAttentionByMinSeverity,
  getPilotReadinessAttentionItems,
  type PilotReadinessAttentionItem,
} from "@/lib/pilot-readiness-attention";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

type PilotReadinessBannerProps = {
  /** When false, hide informational items (e.g. connector `off`) on dense surfaces. */
  showInfoLevel?: boolean;
};

function severityStyles(severity: PilotReadinessAttentionItem["severity"]): string {
  switch (severity) {
    case "blocking":
      return "border-amber-700/80 bg-amber-950/40 text-amber-100/95";
    case "warning":
      return "border-amber-800/60 bg-amber-950/25 text-amber-100/90";
    default:
      return "border-slate-700 bg-slate-900/50 text-slate-300";
  }
}

export function PilotReadinessBanner({ showInfoLevel = false }: PilotReadinessBannerProps) {
  const to = useJurisdictionLink();
  const [data, setData] = useState<IntegrationStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchIntegrationStatus()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load integration status");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isApiConfigured()) {
    return (
      <div
        className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-400"
        role="status"
      >
        <span className="font-medium text-slate-300">Pilot readiness</span> — API not configured in
        this browser build; integration posture cannot be evaluated here.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm text-slate-500">
        Checking integration readiness…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200/90"
        role="alert"
      >
        <span className="font-medium text-rose-100/95">Pilot readiness</span> — could not load status:{" "}
        {error}. Open{" "}
        <Link href={to("/admin/integrations")} className="text-sky-400 underline-offset-2 hover:underline">
          Integrations
        </Link>{" "}
        after the API is reachable.
      </div>
    );
  }

  const raw = getPilotReadinessAttentionItems(data);
  const items = showInfoLevel ? raw : filterAttentionByMinSeverity(raw, "warning");

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200/85"
        role="status"
      >
        <span className="font-medium text-emerald-100/90">Pilot readiness</span> — no blocking or
        warning issues from the latest integration status. Confirm milestones in{" "}
        <Link href={to("/admin/pilot")} className="text-sky-400 underline-offset-2 hover:underline">
          Pilot hub
        </Link>
        .
      </div>
    );
  }

  const topSeverity = items.some((i) => i.severity === "blocking")
    ? "blocking"
    : items.some((i) => i.severity === "warning")
      ? "warning"
      : "info";

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${severityStyles(topSeverity)}`}
      role="alert"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold tracking-tight">Needs attention — pilot readiness</span>
        <Link
          href={to("/admin/integrations")}
          className="shrink-0 text-xs font-medium text-sky-400 underline-offset-2 hover:underline"
        >
          Integrations →
        </Link>
      </div>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed opacity-95">
        {items.map((item) => (
          <li key={item.id}>{item.message}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed opacity-80">
        Read-only signals from <span className="font-mono">GET /api/integration/status</span> for your
        agency. See also{" "}
        <Link href={to("/admin/configuration")} className="text-sky-400 underline-offset-2 hover:underline">
          Configuration
        </Link>
        .
      </p>
    </div>
  );
}
