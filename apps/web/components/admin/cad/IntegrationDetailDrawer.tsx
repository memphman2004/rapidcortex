"use client";

import type { CadAdminIntegration, CadRawIncidentRow } from "@/lib/api";
import { CadIncidentsTable } from "./CadIncidentsTable";
import { VendorSetupInstructions } from "./VendorSetupInstructions";

export type CadTestResult = { ok: boolean; message: string; latencyMs?: number };

type Props = {
  detail: CadAdminIntegration;
  vendorTitleText: string;
  onClose: () => void;
  detailTab: "overview" | "incidents" | "troubleshoot";
  setDetailTab: (t: "overview" | "incidents" | "troubleshoot") => void;
  incidents: CadRawIncidentRow[];
  incidentsLoading: boolean;
  incidentsFetching: boolean;
  expandedRawId: string | null;
  onToggleRaw: (id: string) => void;
  onRefreshIncidents: () => void;
  onRunTest: () => void;
  testPending: boolean;
  testResult: CadTestResult | null;
  onRegenerateToken: () => void;
  regeneratePending: boolean;
  regenMessage: string | null;
  onCopy: (s: string) => void;
  troubleshootingBullets: string[];
};

export function IntegrationDetailDrawer({
  detail,
  vendorTitleText,
  onClose,
  detailTab,
  setDetailTab,
  incidents,
  incidentsLoading,
  incidentsFetching,
  expandedRawId,
  onToggleRaw,
  onRefreshIncidents,
  onRunTest,
  testPending,
  testResult,
  onRegenerateToken,
  regeneratePending,
  regenMessage,
  onCopy,
  troubleshootingBullets,
}: Props) {
  const curl = `curl -sS -X POST "${detail.webhookUrl}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-RC-Token: <your-token>" \\\n  -d '{"cadNumber":"RC-TEST","incidentType":"TEST","priority":"P3","location":"1 Test St","units":[]}'`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">Integration</p>
            <h2 className="truncate text-xl font-semibold text-white">{detail.name}</h2>
            <p className="text-xs text-slate-500">{vendorTitleText}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-600">ID {detail.id}</p>
          </div>
          <button type="button" className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex shrink-0 gap-1 border-b border-slate-800 px-5 py-2 text-sm">
          {(
            [
              ["overview", "Overview"],
              ["incidents", "Incidents"],
              ["troubleshoot", "Troubleshooting"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDetailTab(key)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                detailTab === key ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {detailTab === "overview" ? (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded border border-slate-700 px-2 py-1 capitalize text-slate-200">{detail.status}</span>
                {detail.errorMessage ? (
                  <span className="rounded border border-rose-800/60 bg-rose-950/30 px-2 py-1 text-rose-200">
                    {detail.errorMessage}
                  </span>
                ) : null}
              </div>
              <p>
                <span className="text-slate-500">Created</span>{" "}
                <span className="text-slate-200">{detail.createdAt}</span>
              </p>
              <p>
                <span className="text-slate-500">Updated</span>{" "}
                <span className="text-slate-200">{detail.updatedAt}</span>
              </p>
              <div>
                <p className="text-slate-500">Webhook URL</p>
                <div className="mt-1 flex gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg border border-slate-800 bg-slate-900 p-2 text-[11px] text-slate-200">
                    {detail.webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => void onCopy(detail.webhookUrl)}
                    className="shrink-0 self-start rounded border border-slate-600 px-2 py-1 text-xs text-sky-400 hover:bg-slate-800"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-sm font-medium text-white">Security token</p>
                <p className="mt-1 text-xs text-slate-500">
                  Rapid Cortex never returns the plaintext token after creation. Regenerate if the CAD vendor lost the secret.
                </p>
                <button
                  type="button"
                  disabled={regeneratePending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "This will immediately invalidate the current token. Any CAD systems using it will stop working until updated.",
                      )
                    ) {
                      onRegenerateToken();
                    }
                  }}
                  className="mt-3 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-40"
                >
                  {regeneratePending ? "Regenerating…" : "Regenerate token"}
                </button>
                {regenMessage ? <p className="mt-2 text-xs text-emerald-300">{regenMessage}</p> : null}
              </div>
              <VendorSetupInstructions text={detail.setupInstructions} />
            </div>
          ) : null}

          {detailTab === "incidents" ? (
            <CadIncidentsTable
              rows={incidents}
              isLoading={incidentsLoading}
              expandedRawId={expandedRawId}
              onToggleRow={(id) => onToggleRaw(id)}
              onRefresh={onRefreshIncidents}
              isRefreshing={incidentsFetching}
            />
          ) : null}

          {detailTab === "troubleshoot" ? (
            <div className="space-y-5 text-sm text-slate-300">
              <button
                type="button"
                onClick={onRunTest}
                disabled={testPending}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {testPending ? "Running…" : "Run connection test"}
              </button>
              {testResult ? (
                <div
                  className={`rounded-lg border px-3 py-3 text-sm ${
                    testResult.ok ?
                      "border-emerald-700/50 bg-emerald-950/30 text-emerald-100"
                    : "border-rose-700/50 bg-rose-950/40 text-rose-100"
                  }`}
                >
                  {testResult.ok ? "Connected" : "Failed"} — {testResult.message}
                  {typeof testResult.latencyMs === "number" ? ` (latency ${testResult.latencyMs} ms)` : ""}
                </div>
              ) : null}
              <div>
                <p className="font-medium text-white">Network requirements</p>
                <p className="mt-1 text-xs text-slate-400">
                  Ensure outbound HTTPS to <code className="text-slate-300">api.rapidcortex.us</code> (or your agency API host)
                  is allowed from the CAD export path.
                </p>
                <button
                  type="button"
                  onClick={() => void onCopy(curl)}
                  className="mt-2 rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Copy curl test command
                </button>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-xs text-slate-400">
                {troubleshootingBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <a
                className="inline-block text-xs text-sky-400 hover:text-sky-300"
                href="/integration-guide/cad"
                target="_blank"
                rel="noreferrer"
              >
                Download integration guide (CAD)
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
