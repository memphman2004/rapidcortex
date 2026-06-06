"use client";

import type { CadAdminIntegration } from "@/lib/api";
import {
  formatRelative,
  statusDotClass,
  truncate,
  vendorBadgeClass,
  vendorTitle,
} from "./cad-admin-ui-helpers";

type Props = {
  row: CadAdminIntegration;
  onTest: () => void;
  onConfigure: () => void;
  onToggleActive: (next: boolean) => void;
  onDelete: () => void;
  isTestPending: boolean;
  isPatchPending: boolean;
};

export function CadIntegrationCard({
  row,
  onTest,
  onConfigure,
  onToggleActive,
  onDelete,
  isTestPending,
  isPatchPending,
}: Props) {
  const isActive = row.status === "active";
  return (
    <article className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm shadow-black/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">{row.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{vendorTitle(row.vendor)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-300">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass(row.status)}`} aria-hidden />
          <span className="capitalize">{row.status}</span>
        </div>
      </div>
      <div className="mt-2">
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${vendorBadgeClass(row.vendor)}`}>
          {row.vendor.replace(/_/g, " ")}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-slate-400">
        <div className="flex justify-between gap-2">
          <dt>Last sync</dt>
          <dd className="text-slate-200">{formatRelative(row.lastIncidentAt ?? row.lastPingAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Incidents</dt>
          <dd className="font-mono text-slate-200">{row.incidentCount.toLocaleString()}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5 font-mono text-[10px] text-slate-300">
        <span className="min-w-0 flex-1 truncate" title={row.webhookUrl}>
          {truncate(row.webhookUrl, 44)}
        </span>
        <button
          type="button"
          className="shrink-0 text-sky-400 hover:text-sky-300"
          aria-label="Copy webhook URL"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(row.webhookUrl);
          }}
        >
          Copy
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={onTest}
          disabled={isTestPending}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          Test
        </button>
        <button
          type="button"
          onClick={onConfigure}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
        >
          Configure
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">{isActive ? "Active" : "Inactive"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            disabled={isPatchPending}
            onClick={() => onToggleActive(!isActive)}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
              isActive ? "border-emerald-600/60 bg-emerald-600/30" : "border-slate-600 bg-slate-800"
            } disabled:opacity-40`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                isActive ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
