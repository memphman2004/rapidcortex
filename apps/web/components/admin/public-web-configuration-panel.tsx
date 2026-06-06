"use client";

import { getPublicWebConfigurationRows } from "@/lib/public-web-config";
import {
  isOfflineDemoDataEnabled,
  isTrainingTranscriptToolbarEnabled,
} from "@/lib/runtime-flags";
import { isApiConfigured } from "@/lib/api";

export function PublicWebConfigurationPanel() {
  const rows = getPublicWebConfigurationRows();
  const apiOn = isApiConfigured();

  return (
    <div className="space-y-4 text-sm text-slate-300">
      <p className="text-xs leading-relaxed text-slate-500">
        Browser-visible configuration only (<span className="font-mono text-slate-400">NEXT_PUBLIC_*</span>).
        Lambda secrets, provider API keys, and <span className="font-mono text-slate-400">API_UPSTREAM_BASE</span> are{" "}
        <span className="font-medium text-slate-400">server-only</span> — see{" "}
        <span className="font-mono text-slate-400">docs/ENVIRONMENT_CONFIGURATION_REFERENCE.md</span> and{" "}
        <span className="font-mono text-slate-400">docs/FEATURE_FLAGS.md</span>.
      </p>
      <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/50">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Check</th>
              <th className="px-3 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-800/80">
              <td className="px-3 py-2 text-slate-400">API connectivity (client)</td>
              <td
                className={`px-3 py-2 font-medium ${apiOn ? "text-emerald-400" : "text-amber-300"}`}
              >
                {apiOn ? "configured" : "not configured"}
              </td>
            </tr>
            <tr className="border-b border-slate-800/80">
              <td className="px-3 py-2 text-slate-400">Offline demo incident mode</td>
              <td className={`px-3 py-2 ${isOfflineDemoDataEnabled() ? "text-amber-300" : "text-slate-200"}`}>
                {isOfflineDemoDataEnabled() ? "ON (local/sales only)" : "off"}
              </td>
            </tr>
            <tr className="border-b border-slate-800/80">
              <td className="px-3 py-2 text-slate-400">Dashboard training transcript toolbar</td>
              <td className="px-3 py-2 text-slate-200">
                {isTrainingTranscriptToolbarEnabled() ? "enabled" : "disabled"}
              </td>
            </tr>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-800/80">
                <td className="px-3 py-2 align-top font-mono text-slate-500">
                  {r.key}
                  {r.note ? (
                    <div className="mt-0.5 font-sans text-[10px] font-normal text-slate-600">{r.note}</div>
                  ) : null}
                </td>
                <td className="break-all px-3 py-2 align-top font-mono text-slate-200">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
