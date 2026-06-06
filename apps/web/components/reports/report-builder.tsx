"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type { ReportResult, ReportType } from "rapid-cortex-shared";
import { REPORT_TYPE_LABELS, reportTypeSchema } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { StatCard } from "@/components/dashboards/stat-card";
import { ReportTable } from "@/components/reports/report-table";
import { fetchAdminUsers, isApiConfigured } from "@/lib/api";
import {
  dateInputToRange,
  defaultReportName,
  downloadReportCsv,
  generateReport,
  isReportsApiConfigured,
} from "@/lib/reports-api";
import { isReportsEnabled } from "@/lib/runtime-flags";

const ALL_TYPES = reportTypeSchema.options;

function summaryValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export type ReportBuilderProps = {
  initialType?: ReportType;
  initialStart?: string;
  initialEnd?: string;
  initialName?: string;
  onGenerated?: (result: ReportResult) => void;
  compact?: boolean;
};

export function ReportBuilder({
  initialType = "incident_summary",
  initialStart,
  initialEnd,
  initialName,
  onGenerated,
  compact,
}: ReportBuilderProps) {
  const { user } = useSession();
  const supervisor = user ? isSupervisorOrAdmin(user.role) : false;
  const enabled = isReportsEnabled() && isReportsApiConfigured();

  const { today, weekAgo } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 86_400_000);
    return {
      today: end.toISOString().slice(0, 10),
      weekAgo: start.toISOString().slice(0, 10),
    };
  }, []);

  const allowedTypes = useMemo(
    () => (supervisor ? ALL_TYPES : (["dispatcher_performance"] as ReportType[])),
    [supervisor],
  );

  const [type, setType] = useState<ReportType>(
    allowedTypes.includes(initialType) ? initialType : allowedTypes[0]!,
  );
  const [name, setName] = useState(initialName ?? defaultReportName(type));
  const [startDate, setStartDate] = useState(initialStart ?? weekAgo);
  const [endDate, setEndDate] = useState(initialEnd ?? today);
  const [dispatcherIds, setDispatcherIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  const dispatchersQ = useQuery({
    queryKey: ["admin-users", "dispatchers", user?.agencyId],
    queryFn: fetchAdminUsers,
    enabled: enabled && supervisor && isApiConfigured(),
  });

  const agencyDispatchers = useMemo(() => {
    const list = dispatchersQ.data ?? [];
    return list.filter(
      (u) =>
        u.role === "dispatcher" &&
        u.enabled &&
        (!user?.agencyId || u.agencyId === user.agencyId),
    );
  }, [dispatchersQ.data, user]);

  const onTypeChange = (next: ReportType) => {
    setType(next);
    setName(defaultReportName(next));
  };

  const toggleDispatcher = (id: string) => {
    setDispatcherIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onGenerate = async () => {
    if (!startDate || !endDate) return;
    setBusy(true);
    setError(null);
    try {
      const dateRange = dateInputToRange(startDate, endDate);
      const filters: Record<string, unknown> = {};
      if (supervisor && dispatcherIds.length > 0) {
        filters.dispatcherIds = dispatcherIds;
      }
      const generated = await generateReport({
        type,
        name: name.trim() || defaultReportName(type),
        dateRange,
        filters,
      });
      setResult(generated);
      onGenerated?.(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!result) return;
    setExportBusy(true);
    try {
      await downloadReportCsv(result.reportId);
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
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <label className="text-xs text-slate-400">
          Report type
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as ReportType)}
            className="mt-1 block min-w-[12rem] rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {REPORT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>

        <label className="text-xs text-slate-400">
          From
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>

        <label className="text-xs text-slate-400">
          To
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() => void onGenerate()}
          className="rounded bg-sky-900/60 px-4 py-2 text-sm font-medium text-sky-100 ring-1 ring-sky-800 disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate report"}
        </button>
      </div>

      {supervisor && agencyDispatchers.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
          <p className="text-xs font-medium text-slate-400">Dispatcher filter (optional)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {agencyDispatchers.map((d) => (
              <label
                key={d.username}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={dispatcherIds.includes(d.username)}
                  onChange={() => toggleDispatcher(d.username)}
                  className="rounded border-slate-600"
                />
                {d.email}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {result ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(result.summary).map(([key, val]) => (
              <StatCard key={key} label={key.replace(/([A-Z])/g, " $1")} value={summaryValue(val)} />
            ))}
          </div>
          <ReportTable rows={result.rows} onExportCsv={() => void onExport()} exportBusy={exportBusy} />
        </div>
      ) : null}
    </div>
  );
}
