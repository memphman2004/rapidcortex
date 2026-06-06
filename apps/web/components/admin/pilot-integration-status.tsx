"use client";

import { useEffect, useState } from "react";
import {
  fetchIntegrationStatus,
  isApiConfigured,
  type IntegrationStatusPayload,
} from "@/lib/api";

export function PilotIntegrationStatusPanel() {
  const [data, setData] = useState<IntegrationStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) {
      setError(null);
      setData(null);
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load status");
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
      <p className="text-sm text-amber-200/90">
        API is not configured in this browser deployment. Set{" "}
        <span className="font-mono text-amber-100/90">NEXT_PUBLIC_AUTH_PROXY=1</span> and{" "}
        <span className="font-mono text-amber-100/90">API_UPSTREAM_BASE</span> (or{" "}
        <span className="font-mono text-amber-100/90">NEXT_PUBLIC_API_BASE</span>) to load live
        integration status.
      </p>
    );
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-400">Loading integration status…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-400">{error}</p>;
  }

  if (!data) return null;

  const pr = data.pilotReadiness;

  return (
    <div className="space-y-3 text-sm text-slate-300">
      <p>
        <span className="text-slate-500">API stage</span>{" "}
        <span className="font-mono text-slate-200">{data.deploymentStage ?? "—"}</span>
      </p>
      <p>
        <span className="text-slate-500">Transcript connector</span>{" "}
        <span className="font-mono text-slate-200">{data.transcriptSource.mode}</span>
        <span className="text-slate-500">
          {" "}
          · eligible {data.transcriptSource.agencyEligible ? "yes" : "no"} · active{" "}
          {data.transcriptSource.connectorActive ? "yes" : "no"}
        </span>
      </p>
      {pr ? (
        <dl className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs">
          <p className="col-span-2 text-[11px] leading-relaxed text-slate-500">
            Interpreter / review flags on transcript lines (e.g.{" "}
            <span className="font-mono text-slate-400">needsInterpreterReview</span>) appear on the{" "}
            <span className="font-mono text-slate-400">/dashboard</span> workspace when the pipeline sets
            them — not summarized here.
          </p>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Language sessions table</dt>
            <dd className="font-mono text-slate-200">
              {pr.languageSessionsConfigured ? "yes" : "no"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Multilingual strict validation</dt>
            <dd className="font-mono text-slate-200">
              {pr.multilingualStrictValidation ? "on" : "off"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Multilingual config issues</dt>
            <dd
              className={
                pr.multilingualIssueCount > 0 ? "font-mono text-amber-300" : "font-mono text-emerald-300"
              }
            >
              {pr.multilingualIssueCount}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">STT / translation / LID (primary)</dt>
            <dd className="text-right font-mono text-slate-200">
              {pr.multilingualPrimaryStt} / {pr.multilingualPrimaryTranslation} /{" "}
              {pr.multilingualPrimaryLanguageDetector}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">AI chain (primary → tertiary)</dt>
            <dd className="text-right font-mono text-slate-200">
              {pr.aiPrimaryProvider} → {pr.aiSecondaryProvider} → {pr.aiTertiaryProvider}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Assets bucket</dt>
            <dd className="font-mono text-slate-200">
              {pr.assetsBucketConfigured ? "configured" : "missing"}
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="text-[11px] leading-relaxed text-slate-500">{data.auditHint}</p>
    </div>
  );
}
