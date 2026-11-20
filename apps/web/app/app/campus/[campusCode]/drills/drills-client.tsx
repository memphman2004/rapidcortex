"use client";

/**
 * Campus K-12 Safety Drill Compliance Tracker
 *
 * Tracks required safety drills per CISA and state fire/safety code requirements.
 * Provides compliance reporting for state audit.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  Calendar,
  Plus,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  CAMPUS_DRILL_TYPES,
  CAMPUS_DRILL_TYPE_LABELS,
  CAMPUS_DRILL_ANNUAL_MINIMUMS,
  getCurrentSchoolYear,
  campusRoleFamily,
  isRcInternalOperator,
} from "rapid-cortex-shared";
import type {
  CampusDrillRecord,
  CampusDrillCreateBody,
  CampusDrillComplianceSummary,
  CampusDrillType,
} from "rapid-cortex-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  agencyId: string;
  campusCode: string;
  userRole: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchDrills(
  agencyId: string,
  schoolYear: string,
  siteId?: string,
): Promise<CampusDrillRecord[]> {
  const params = new URLSearchParams({ schoolYear });
  if (siteId) params.set("siteId", siteId);
  const res = await fetch(`/api/campus/${agencyId}/drills?${params}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.drills ?? []) as CampusDrillRecord[];
}

async function fetchCompliance(
  agencyId: string,
  siteId: string,
  schoolYear: string,
): Promise<CampusDrillComplianceSummary> {
  const params = new URLSearchParams({ siteId, schoolYear });
  const res = await fetch(`/api/campus/${agencyId}/drills/compliance?${params}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.compliance as CampusDrillComplianceSummary;
}

async function createDrill(
  agencyId: string,
  body: CampusDrillCreateBody,
): Promise<CampusDrillRecord> {
  const res = await fetch(`/api/campus/${agencyId}/drills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.drill as CampusDrillRecord;
}

// ---------------------------------------------------------------------------
// Log Drill Modal
// ---------------------------------------------------------------------------

const DRILL_TYPE_OPTIONS = CAMPUS_DRILL_TYPES.map((t) => ({
  value: t,
  label: CAMPUS_DRILL_TYPE_LABELS[t],
}));

function LogDrillModal({
  agencyId,
  schoolYear,
  siteId,
  onClose,
  onSaved,
}: {
  agencyId: string;
  schoolYear: string;
  siteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<CampusDrillType>("fire_evacuation");
  const [status, setStatus] = useState<"completed" | "scheduled">("completed");
  const [conductedAt, setConductedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [durationMinutes, setDurationMinutes] = useState("");
  const [participantCount, setParticipantCount] = useState("");
  const [conductedBy, setConductedBy] = useState("");
  const [issues, setIssues] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createDrill(agencyId, {
        siteId,
        type,
        status,
        schoolYear,
        conductedAt: status === "completed" ? new Date(conductedAt).toISOString() : undefined,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
        participantCount: participantCount ? parseInt(participantCount) : undefined,
        conductedBy: conductedBy.trim(),
        issues: issues.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log drill");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-white">Log Safety Drill</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Drill Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CampusDrillType)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              {DRILL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "completed" | "scheduled")}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {status === "completed" ? "Date Conducted *" : "Scheduled Date"}
              </label>
              <input
                type="datetime-local"
                required={status === "completed"}
                value={conductedAt}
                onChange={(e) => setConductedAt(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                max="240"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 8"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Participants</label>
              <input
                type="number"
                min="0"
                value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
                placeholder="Total count"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Conducted By *</label>
            <input
              required
              value={conductedBy}
              onChange={(e) => setConductedBy(e.target.value)}
              placeholder="Name and title"
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Issues / Deficiencies</label>
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
              placeholder="Note any deficiencies observed during the drill"
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Log Drill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance Grid
// ---------------------------------------------------------------------------

function ComplianceGrid({ summary }: { summary: CampusDrillComplianceSummary }) {
  const requiredTypes = CAMPUS_DRILL_TYPES.filter(
    (t) => (CAMPUS_DRILL_ANNUAL_MINIMUMS[t] ?? 0) > 0,
  );

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">Compliance Status</h3>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            summary.overallCompliant
              ? "bg-green-900/40 text-green-400"
              : "bg-red-900/40 text-red-400"
          }`}
        >
          {summary.overallCompliant ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {summary.overallCompliant ? "On Track" : "Attention Needed"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {requiredTypes.map((type) => {
          const stat = summary.byType[type];
          return (
            <div
              key={type}
              className={`rounded-lg border p-3 ${
                stat.isCompliant
                  ? "border-green-700/40 bg-green-900/20"
                  : "border-amber-700/40 bg-amber-900/20"
              }`}
            >
              <p className="text-xs text-slate-400">{CAMPUS_DRILL_TYPE_LABELS[type]}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={`text-xl font-bold ${
                    stat.isCompliant ? "text-green-400" : "text-amber-400"
                  }`}
                >
                  {stat.completed}
                </span>
                <span className="text-xs text-slate-500">/ {stat.minimumRequired} required</span>
              </div>
              {stat.scheduled > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">{stat.scheduled} scheduled</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CampusDrillsClient({ agencyId, campusCode, userRole }: Props) {
  const queryClient = useQueryClient();
  const [schoolYear, setSchoolYear] = useState(getCurrentSchoolYear());
  const [showLogModal, setShowLogModal] = useState(false);
  // For compliance, default to first site. In production, use site picker from campus sites list.
  const defaultSiteId = agencyId;

  const canWrite =
    isRcInternalOperator(userRole) ||
    campusRoleFamily(userRole) === "admin" ||
    campusRoleFamily(userRole) === "supervisor";

  const { data: drills = [], isLoading, error, refetch } = useQuery({
    queryKey: ["campus-drills", agencyId, schoolYear],
    queryFn: () => fetchDrills(agencyId, schoolYear),
  });

  const { data: compliance } = useQuery({
    queryKey: ["campus-drill-compliance", agencyId, schoolYear],
    queryFn: () => fetchCompliance(agencyId, defaultSiteId, schoolYear),
    enabled: drills.length >= 0,
  });

  // Generate school year options (current + past 2 years)
  const currentYear = getCurrentSchoolYear();
  const [curStart] = currentYear.split("-");
  const yearOptions = [0, 1, 2].map((offset) => {
    const start = parseInt(curStart) - offset;
    const end = start + 1;
    return `${start}-${String(end).slice(2)}`;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Safety Drill Compliance</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Track required drills for state compliance reporting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>SY {y}</option>
            ))}
          </select>
          {canWrite && (
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              Log Drill
            </button>
          )}
          <button onClick={() => refetch()} className="rounded-lg p-2 text-slate-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compliance overview */}
      {compliance && <ComplianceGrid summary={compliance} />}

      {/* Drill log */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
        <h3 className="mb-3 font-semibold text-white">Drill Log — SY {schoolYear}</h3>
        {isLoading ? (
          <p className="py-6 text-center text-slate-400">Loading drills…</p>
        ) : error ? (
          <p className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            Drill tracking not available. The drill tracking table may not be provisioned in this environment.
          </p>
        ) : drills.length === 0 ? (
          <div className="py-8 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-2 text-slate-400">No drills logged for SY {schoolYear}.</p>
            {canWrite && (
              <button
                onClick={() => setShowLogModal(true)}
                className="mt-3 text-sm text-sky-400 hover:underline"
              >
                Log the first drill
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-slate-700/40">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700/40 bg-slate-800/60">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Duration</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Participants</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Conducted By</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-300">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {[...drills]
                  .sort((a, b) => (b.conductedAt ?? "").localeCompare(a.conductedAt ?? ""))
                  .map((d) => (
                    <tr key={d.drillId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-white">
                        {CAMPUS_DRILL_TYPE_LABELS[d.type]}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                            d.status === "completed"
                              ? "bg-green-900/40 text-green-400"
                              : d.status === "scheduled"
                                ? "bg-sky-900/40 text-sky-400"
                                : "bg-slate-700/60 text-slate-400"
                          }`}
                        >
                          {d.status === "completed" ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <Calendar className="h-3 w-3" />
                          )}
                          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {d.conductedAt
                          ? new Date(d.conductedAt).toLocaleDateString()
                          : d.scheduledAt
                            ? new Date(d.scheduledAt).toLocaleDateString()
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {d.durationMinutes ? `${d.durationMinutes} min` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {d.participantCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{d.conductedBy}</td>
                      <td className="px-4 py-3">
                        {d.issues ? (
                          <span className="text-amber-400 text-xs">{d.issues}</span>
                        ) : (
                          <span className="text-slate-600 text-xs">None noted</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showLogModal && (
        <LogDrillModal
          agencyId={agencyId}
          schoolYear={schoolYear}
          siteId={defaultSiteId}
          onClose={() => setShowLogModal(false)}
          onSaved={() => {
            setShowLogModal(false);
            queryClient.invalidateQueries({ queryKey: ["campus-drills", agencyId, schoolYear] });
            queryClient.invalidateQueries({ queryKey: ["campus-drill-compliance", agencyId, schoolYear] });
          }}
        />
      )}
    </div>
  );
}
