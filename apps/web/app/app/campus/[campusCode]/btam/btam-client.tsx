"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  BTAM_ACTION_TYPE_LABELS,
  BTAM_CONCERN_TYPE_LABELS,
  BTAM_STATUS_LABELS,
  BTAM_WRITE_ROLE_FAMILIES,
} from "rapid-cortex-shared";
import type {
  BtamCaseRecord,
  BtamCaseStatus,
  BtamConcernType,
  BtamReferralSource,
} from "rapid-cortex-shared";
import { campusRoleFamily } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import {
  addBtamAction,
  fetchBtamCases,
  openBtamCase,
  patchBtamCase,
} from "@/lib/campus/campus-btam-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BtamClientProps {
  campusCode: string;
  agencyId: string;
  userRole: string;
}

type StatusFilter = "all" | BtamCaseStatus;

// ─── Status styling ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<BtamCaseStatus, { label: string; color: string }> = {
  open:      { label: "Open",          color: "bg-red-900/60 text-red-200 border-red-800/60" },
  gathering: { label: "Gathering Info", color: "bg-orange-900/60 text-orange-200 border-orange-800/60" },
  assessing: { label: "TAT Review",    color: "bg-yellow-900/60 text-yellow-200 border-yellow-800/60" },
  monitoring:{ label: "Monitoring",    color: "bg-sky-900/60 text-sky-200 border-sky-800/60" },
  closed:    { label: "Closed",        color: "bg-slate-800/60 text-slate-400 border-slate-700/60" },
  referred:  { label: "Referred",      color: "bg-purple-900/60 text-purple-200 border-purple-800/60" },
  escalated: { label: "Escalated",     color: "bg-rose-900/60 text-rose-200 border-rose-800/60" },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BtamClient({ campusCode, agencyId, userRole }: BtamClientProps) {
  const qc = useQueryClient();
  const roleFamily = campusRoleFamily(userRole);
  const canWrite = BTAM_WRITE_ROLE_FAMILIES.has(roleFamily ?? "");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);

  const casesQuery = useQuery({
    queryKey: ["btam-cases", agencyId, campusCode, statusFilter],
    queryFn: () =>
      fetchBtamCases(agencyId, {
        campusCode,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const cases = casesQuery.data?.cases ?? [];

  const stats = useMemo(
    () => ({
      total: cases.length,
      open: cases.filter((c) => c.status === "open").length,
      active: cases.filter((c) => ["open", "gathering", "assessing", "monitoring"].includes(c.status)).length,
      escalated: cases.filter((c) => c.status === "escalated").length,
    }),
    [cases],
  );

  const patchMutation = useMutation({
    mutationFn: ({ caseId, status }: { caseId: string; status: BtamCaseStatus }) =>
      patchBtamCase(agencyId, caseId, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["btam-cases", agencyId] }),
  });

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <ClipboardCheck className="h-6 w-6 text-amber-400" />
            Threat Assessment (BTAM)
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Behavioral Threat Assessment & Management — TAT team access only. FERPA-restricted.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void casesQuery.refetch()}
            disabled={casesQuery.isFetching}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${casesQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canWrite && (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-1.5 rounded-md border border-amber-700/50 bg-amber-900/30 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-900/50"
            >
              <Plus className="h-3.5 w-3.5" />
              Open Case
            </button>
          )}
        </div>
      </div>

      {/* Legal disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-sm text-amber-200 space-y-1">
          <p>
            <strong>Important:</strong> This module supports the Threat Assessment Team (TAT) in
            gathering information and coordinating a supportive response. It does{" "}
            <strong>not</strong> automate threat classification, disciplinary decisions, or identify
            individuals as threats. All decisions are made by qualified human team members.
          </p>
          <p className="text-amber-300/70">
            Records in this module are FERPA-protected student information. Access is logged and
            audited. Do not share outside of authorized TAT personnel.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Cases", value: stats.total, icon: ClipboardCheck, color: "text-slate-300" },
          { label: "New / Open", value: stats.open, icon: AlertTriangle, color: "text-red-400" },
          { label: "Active", value: stats.active, icon: ShieldAlert, color: "text-amber-400" },
          { label: "Escalated", value: stats.escalated, icon: AlertTriangle, color: "text-rose-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3">
            <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${color}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
          >
            <option value="all">All</option>
            {(Object.keys(BTAM_STATUS_LABELS) as BtamCaseStatus[]).map((s) => (
              <option key={s} value={s}>{BTAM_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        {casesQuery.isError && (
          <span className="text-sm text-red-400">
            {casesQuery.error instanceof Error ? casesQuery.error.message : "Failed to load"}
          </span>
        )}
        {patchMutation.isError && (
          <span className="text-sm text-red-400">
            {patchMutation.error instanceof Error ? patchMutation.error.message : "Action failed"}
          </span>
        )}
      </div>

      {/* Cases list */}
      {casesQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading cases…</p>
      ) : cases.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">
            No BTAM cases {statusFilter !== "all" ? `with status "${BTAM_STATUS_LABELS[statusFilter as BtamCaseStatus]}"` : "open"}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <BtamCaseCard
              key={c.caseId}
              record={c}
              isExpanded={expandedId === c.caseId}
              canWrite={canWrite}
              agencyId={agencyId}
              onToggle={() => setExpandedId(expandedId === c.caseId ? null : c.caseId)}
              onStatusChange={(status) => patchMutation.mutate({ caseId: c.caseId, status })}
              onAddAction={() => setActionCaseId(c.caseId)}
            />
          ))}
        </div>
      )}

      {/* Open Case modal */}
      {showOpenModal && (
        <OpenCaseModal
          campusCode={campusCode}
          agencyId={agencyId}
          onClose={() => setShowOpenModal(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ["btam-cases", agencyId] });
            setShowOpenModal(false);
          }}
        />
      )}

      {/* Add Action modal */}
      {actionCaseId && (
        <AddActionModal
          agencyId={agencyId}
          caseId={actionCaseId}
          onClose={() => setActionCaseId(null)}
          onAdded={() => {
            void qc.invalidateQueries({ queryKey: ["btam-cases", agencyId] });
            setActionCaseId(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Case Card ────────────────────────────────────────────────────────────────

interface BtamCaseCardProps {
  record: BtamCaseRecord;
  isExpanded: boolean;
  canWrite: boolean;
  agencyId: string;
  onToggle: () => void;
  onStatusChange: (status: BtamCaseStatus) => void;
  onAddAction: () => void;
}

const NEXT_STATUSES: Partial<Record<BtamCaseStatus, BtamCaseStatus[]>> = {
  open:      ["gathering", "escalated", "closed"],
  gathering: ["assessing", "escalated", "closed"],
  assessing: ["monitoring", "referred", "escalated", "closed"],
  monitoring:["closed", "escalated"],
};

function BtamCaseCard({
  record,
  isExpanded,
  canWrite,
  onToggle,
  onStatusChange,
  onAddAction,
}: BtamCaseCardProps) {
  const badge = STATUS_BADGE[record.status];
  const isActive = ["open", "gathering", "assessing", "monitoring"].includes(record.status);
  const nextStatuses = NEXT_STATUSES[record.status] ?? [];

  return (
    <div
      className={`rounded-lg border bg-slate-800/60 ${
        isActive ? "border-amber-800/40" : "border-slate-700/50"
      }`}
    >
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="mt-0.5 shrink-0">
          {isActive ? (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          ) : (
            <ClipboardCheck className="h-4 w-4 text-slate-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{record.caseId.slice(5, 13)}</span>
            <span className="font-medium text-white">Subject: {record.subjectLabel}</span>
            {record.subjectGrade && (
              <span className="text-xs text-slate-400">Grade {record.subjectGrade}</span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {record.concernTypes.map((ct) => (
              <span
                key={ct}
                className="rounded-full border border-slate-700 bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300"
              >
                {BTAM_CONCERN_TYPE_LABELS[ct] ?? ct}
              </span>
            ))}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Opened {formatRelativeTime(record.createdAt)}
            {record.assignedToName && ` · Assigned to ${record.assignedToName}`}
          </div>
        </div>
        <span className="ml-2 shrink-0 text-slate-500">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3 space-y-4">
          {/* Notes */}
          {record.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Case notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{record.notes}</p>
            </div>
          )}

          {/* Safety plan summary */}
          {record.safetyPlanSummary && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Safety plan summary</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{record.safetyPlanSummary}</p>
            </div>
          )}

          {/* Action log */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              TAT Action log ({record.actions.length})
            </p>
            {record.actions.length === 0 ? (
              <p className="text-xs text-slate-500">No actions recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {[...record.actions].reverse().map((action) => (
                  <div
                    key={action.actionId}
                    className="rounded-md border border-slate-700/40 bg-slate-900/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-300">
                        {BTAM_ACTION_TYPE_LABELS[action.type] ?? action.type}
                      </span>
                      <span>{formatRelativeTime(action.performedAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-300">{action.description}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {action.performedByName ?? action.performedBy}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI advisory */}
          <div className="flex items-start gap-2 rounded-md border border-slate-700/50 bg-slate-900/50 px-3 py-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <p className="text-xs text-slate-500">
              NexCort iQ does not automatically classify threat levels or identify suspects. The
              TAT reviews all information and makes informed, human-driven decisions. No automatic
              denial of school services based on this record.
            </p>
          </div>

          {/* Actions */}
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onAddAction}
                className="flex items-center gap-1.5 rounded-md border border-sky-700/50 bg-sky-900/30 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-900/50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add TAT Action
              </button>
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${STATUS_BADGE[s].color} hover:opacity-80`}
                >
                  → {BTAM_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Open Case Modal ──────────────────────────────────────────────────────────

function OpenCaseModal({
  campusCode,
  agencyId,
  onClose,
  onCreated,
}: {
  campusCode: string;
  agencyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subjectLabel, setSubjectLabel] = useState("");
  const [subjectGrade, setSubjectGrade] = useState("");
  const [referralSource, setReferralSource] = useState<BtamReferralSource>("anonymous_tip");
  const [concernTypes, setConcernTypes] = useState<BtamConcernType[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      openBtamCase(agencyId, {
        campusCode,
        subjectLabel: subjectLabel.trim(),
        subjectGrade: subjectGrade.trim() || undefined,
        referralSource,
        concernTypes,
        notes: notes.trim() || undefined,
      }),
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to open case"),
  });

  const toggleConcern = (ct: BtamConcernType) => {
    setConcernTypes((prev) =>
      prev.includes(ct) ? prev.filter((x) => x !== ct) : [...prev, ct],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Open BTAM Case</h2>

        <div className="flex items-start gap-2 mb-4 rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200">
            Use an internal ID or redacted label (e.g. "Student A, 10th grade"). Avoid storing full
            legal names in NexCort iQ — keep detailed records in your SIS or case management system.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Subject label <span className="text-red-400">*</span>
            </label>
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
              placeholder="e.g. Student A — Grade 10"
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Grade (optional)</label>
            <input
              className="mt-1 w-32 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="e.g. 9"
              value={subjectGrade}
              onChange={(e) => setSubjectGrade(e.target.value)}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Referral source <span className="text-red-400">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value as BtamReferralSource)}
            >
              {(
                [
                  ["anonymous_tip", "Anonymous Tip (QR/SMS)"],
                  ["staff_report", "Staff Report"],
                  ["student_disclosure", "Student Disclosure"],
                  ["parent_report", "Parent / Guardian Report"],
                  ["law_enforcement", "Law Enforcement / SRO"],
                  ["counselor", "School Counselor"],
                  ["social_media", "Social Media Alert"],
                  ["incident_escalation", "Escalated from Campus Incident"],
                  ["other", "Other"],
                ] as [BtamReferralSource, string][]
              ).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Concern types <span className="text-red-400">*</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(BTAM_CONCERN_TYPE_LABELS) as BtamConcernType[]).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => toggleConcern(ct)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    concernTypes.includes(ct)
                      ? "border-amber-600 bg-amber-900/50 text-amber-200"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {BTAM_CONCERN_TYPE_LABELS[ct]}
                </button>
              ))}
            </div>
            {concernTypes.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">Select at least one concern type.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Initial notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              rows={3}
              maxLength={10_000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the situation, context, and any immediate concerns…"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!subjectLabel.trim() || concernTypes.length === 0 || mutation.isPending}
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {mutation.isPending ? "Opening…" : "Open Case"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Action Modal ─────────────────────────────────────────────────────────

type ActionType = BtamCaseRecord["actions"][0]["type"];

function AddActionModal({
  agencyId,
  caseId,
  onClose,
  onAdded,
}: {
  agencyId: string;
  caseId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [actionType, setActionType] = useState<ActionType>("note_added");
  const [description, setDescription] = useState("");
  const [safetyPlan, setSafetyPlan] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      addBtamAction(agencyId, caseId, {
        type: actionType,
        description: description.trim(),
        safetyPlanSummary: safetyPlan.trim() || undefined,
      }),
    onSuccess: onAdded,
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to add action"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Add TAT Action</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Action type <span className="text-red-400">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
            >
              {(Object.entries(BTAM_ACTION_TYPE_LABELS) as [ActionType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              rows={4}
              maxLength={5_000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what was done, who was involved, and any outcomes…"
            />
          </div>
          {(actionType === "safety_plan_created" || actionType === "monitoring_added") && (
            <div>
              <label className="block text-sm font-medium text-slate-300">Safety plan summary</label>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                rows={3}
                maxLength={2_000}
                value={safetyPlan}
                onChange={(e) => setSafetyPlan(e.target.value)}
                placeholder="Brief summary of accommodations and monitoring agreed by the TAT…"
              />
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!description.trim() || mutation.isPending}
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Save Action"}
          </button>
        </div>
      </div>
    </div>
  );
}
