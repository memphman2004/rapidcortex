"use client";

import type { ReactNode } from "react";

import type { SurgeClusterDetail } from "rapid-cortex-shared";

/**
 * Reads server-provided CAD summary (`cluster.summary`). No `@rapid-cortex/api` imports in the browser bundle.
 */
export function SurgeClusterDetailSheet({
  cluster,
  onClose,
  children,
}: {
  cluster: SurgeClusterDetail;
  onClose: () => void;
  /** Extra actions row (confirm / dismiss wired to API by parent). */
  children?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="surge-detail-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 id="surge-detail-title" className="text-lg font-bold text-white">
              Surge View cluster
            </h2>
            <p className="text-xs text-slate-400">
              {cluster.incidentIds.length} incidents · {Math.round(cluster.confidence * 100)}% confidence
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-slate-500 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {cluster.headlineKeywords.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1">
              {cluster.headlineKeywords.map((k) => (
                <span key={k} className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-200">
                  {k}
                </span>
              ))}
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">CAD summary</div>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-200">{cluster.summary}</pre>
          </div>
          {cluster.uniqueDetails.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              {cluster.uniqueDetails.map((d, i) => (
                <li key={`detail-${cluster.clusterId}-${i}`} className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                  {d}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {children ? (
          <div className="border-t border-slate-800 px-4 py-3">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
