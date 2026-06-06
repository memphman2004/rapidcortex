"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type { ReportConfig, ReportType } from "rapid-cortex-shared";
import { REPORT_TYPE_LABELS } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { ActivityFeed } from "@/components/dashboards/activity-feed";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportTable } from "@/components/reports/report-table";
import {
  dateInputToRange,
  defaultReportName,
  downloadReportCsv,
  fetchReport,
  fetchReports,
  generateReport,
  isReportsApiConfigured,
  lastNDaysRange,
} from "@/lib/reports-api";
import { isReportsEnabled } from "@/lib/runtime-flags";
import type { ActivityItem } from "@/lib/dashboards/mockDashboardData";

function configToActivity(config: ReportConfig): ActivityItem {
  const start = new Date(config.dateRange.start).toLocaleDateString();
  const end = new Date(config.dateRange.end).toLocaleDateString();
  return {
    id: config.reportId,
    title: config.name,
    description: `${REPORT_TYPE_LABELS[config.type]} · ${start} – ${end}`,
    timeLabel: new Date(config.createdAt).toLocaleString(),
    tone: "pending",
  };
}

export function ReportsDashboard() {
  const { user } = useSession();
  const qc = useQueryClient();
  const supervisor = user ? isSupervisorOrAdmin(user.role) : false;
  const enabled = isReportsEnabled() && isReportsApiConfigured();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
    enabled,
  });

  const detailQ = useQuery({
    queryKey: ["reports", selectedId],
    queryFn: () => fetchReport(selectedId!),
    enabled: enabled && Boolean(selectedId),
  });

  const recent = useMemo(() => (listQ.data ?? []).slice(0, 12), [listQ.data]);
  const activityItems = useMemo(() => recent.map(configToActivity), [recent]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["reports"] });
  };

  const quickGenerate = async (type: ReportType, days: number, label: string) => {
    setQuickBusy(label);
    setError(null);
    try {
      const range = lastNDaysRange(days);
      const result = await generateReport({
        type,
        name: `${label} — ${new Date().toLocaleDateString()}`,
        dateRange: dateInputToRange(range.startInput, range.endInput),
      });
      setSelectedId(result.reportId);
      await invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quick generate failed");
    } finally {
      setQuickBusy(null);
    }
  };

  const regenerate = async (config: ReportConfig) => {
    setQuickBusy(config.reportId);
    setError(null);
    try {
      const result = await generateReport({
        type: config.type,
        name: defaultReportName(config.type),
        dateRange: config.dateRange,
        filters: config.filters,
      });
      setSelectedId(result.reportId);
      await invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setQuickBusy(null);
    }
  };

  const onExport = async (reportId: string) => {
    setExportBusy(true);
    setError(null);
    try {
      await downloadReportCsv(reportId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  };

  if (!enabled) {
    return (
      <p className="text-sm text-slate-500">Reports are disabled in this environment.</p>
    );
  }

  return (
    <div className="space-y-8">
      {supervisor ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Quick generate</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={quickBusy !== null}
              onClick={() => void quickGenerate("incident_summary", 7, "Weekly summary")}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-700 disabled:opacity-40"
            >
              {quickBusy === "Weekly summary" ? "…" : "Weekly summary"}
            </button>
            <button
              type="button"
              disabled={quickBusy !== null}
              onClick={() => void quickGenerate("sla_compliance", 7, "SLA report")}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-700 disabled:opacity-40"
            >
              {quickBusy === "SLA report" ? "…" : "SLA report"}
            </button>
            <button
              type="button"
              disabled={quickBusy !== null}
              onClick={() => void quickGenerate("qa_scores", 30, "QA scores")}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-700 disabled:opacity-40"
            >
              {quickBusy === "QA scores" ? "…" : "QA scores"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Report builder</h2>
        <ReportBuilder
          onGenerated={async (r) => {
            setSelectedId(r.reportId);
            await invalidate();
          }}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Recent reports</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {listQ.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {recent.length === 0 && !listQ.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      No saved reports yet.
                    </td>
                  </tr>
                ) : null}
                {recent.map((c) => (
                  <tr
                    key={c.reportId}
                    className={`hover:bg-slate-900/50 ${selectedId === c.reportId ? "bg-slate-900/60" : ""}`}
                  >
                    <td className="px-3 py-2 text-xs">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{REPORT_TYPE_LABELS[c.type]}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.reportId)}
                          className="text-xs text-sky-400 hover:underline"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          disabled={quickBusy === c.reportId}
                          onClick={() => void regenerate(c)}
                          className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
                        >
                          Regenerate
                        </button>
                        <button
                          type="button"
                          disabled={exportBusy}
                          onClick={() => void onExport(c.reportId)}
                          className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
                        >
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ActivityFeed items={activityItems} />
      </section>

      {selectedId && detailQ.data ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Selected report</h2>
          <ReportTable
            rows={detailQ.data.rows}
            onExportCsv={() => void onExport(selectedId)}
            exportBusy={exportBusy}
          />
        </section>
      ) : null}
    </div>
  );
}
