"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { campusRoleFamily } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import {
  escalateCampusIncident,
  fetchAnonymousTips,
  patchCampusIncident,
} from "@/lib/campus/campus-incidents-api";
import type { CampusIncident, CampusIncidentStatus } from "@/lib/campus/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceFilter = "all" | "qr" | "sms";
type StatusFilter = "all" | CampusIncidentStatus;

interface AnonymousTipsClientProps {
  campusCode: string;
  agencyId: string;
  userRole: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  qr: "QR Code",
  sms: "SMS / Text",
  manual: "Staff Entry",
  phone: "Phone",
};

const STATUS_BADGE: Record<CampusIncidentStatus, { label: string; color: string }> = {
  open: { label: "New", color: "bg-red-900/60 text-red-200 border-red-800/60" },
  assigned: { label: "Acknowledged", color: "bg-yellow-900/60 text-yellow-200 border-yellow-800/60" },
  responding: { label: "Responding", color: "bg-sky-900/60 text-sky-200 border-sky-800/60" },
  resolved: { label: "Closed", color: "bg-green-900/60 text-green-200 border-green-800/60" },
  referred: { label: "Referred", color: "bg-slate-700/60 text-slate-200 border-slate-600/60" },
  escalated: { label: "Escalated", color: "bg-purple-900/60 text-purple-200 border-purple-800/60" },
};

const TYPE_LABELS: Record<string, string> = {
  mental_health: "Mental Health",
  wellness_check: "Wellness Check",
  security: "Security Concern",
  suspicious_activity: "Suspicious Activity",
  medical: "Medical",
  property_crime: "Property / Theft",
  bullying: "Bullying",
  harassment: "Harassment",
  other: "Other",
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

export function AnonymousTipsClient({ campusCode, userRole }: AnonymousTipsClientProps) {
  const qc = useQueryClient();
  const roleFamily = campusRoleFamily(userRole);
  const canWrite = roleFamily === "admin" || roleFamily === "supervisor";

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const tipsQuery = useQuery({
    queryKey: ["campus-tips", campusCode, sourceFilter],
    queryFn: () =>
      fetchAnonymousTips(campusCode, {
        source: sourceFilter !== "all" ? (sourceFilter as "qr" | "sms") : undefined,
      }),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const tips = tipsQuery.data ?? [];

  const filtered = useMemo(() => {
    let rows = tips;
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    return [...rows].sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (b.status === "open" && a.status !== "open") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tips, statusFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(
    () => ({
      total: tips.length,
      open: tips.filter((t) => t.status === "open").length,
      acknowledged: tips.filter((t) => t.status === "assigned").length,
      resolved: tips.filter((t) => t.status === "resolved").length,
    }),
    [tips],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const mutate = useMutation({
    mutationFn: async (action: { type: "ack" | "close" | "escalate"; id: string }) => {
      if (action.type === "ack") {
        await patchCampusIncident(campusCode, action.id, { status: "assigned" });
      } else if (action.type === "close") {
        await patchCampusIncident(campusCode, action.id, { status: "resolved" });
      } else {
        await escalateCampusIncident(campusCode, action.id);
      }
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["campus-tips", campusCode] }),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-1">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-sky-400" />
            Anonymous Tips
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            QR code and SMS reports submitted anonymously by students, staff, or community members.
            All entries are confidential — handle with care.
          </p>
        </div>
        <button
          onClick={() => void tipsQuery.refetch()}
          disabled={tipsQuery.isFetching}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${tipsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Privacy banner */}
      <div className="flex items-start gap-3 rounded-lg border border-sky-800/40 bg-sky-950/30 px-4 py-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-sm text-sky-200">
          <strong>Confidentiality notice:</strong> These reports were submitted with an expectation of
          anonymity. Do not share reporter identity or report details outside of necessary safety
          personnel. Document follow-up actions in the incident record. AI advisory labels are
          informational only — human staff make all safety decisions.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Tips", value: stats.total, icon: MessageSquare, color: "text-slate-300" },
          { label: "New / Unread", value: stats.open, icon: ShieldAlert, color: "text-red-400" },
          { label: "Acknowledged", value: stats.acknowledged, icon: Clock, color: "text-yellow-400" },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3"
          >
            <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${color}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Source
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
          >
            <option value="all">All sources</option>
            <option value="qr">QR Code only</option>
            <option value="sms">SMS / Text only</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
          >
            <option value="all">All statuses</option>
            <option value="open">New</option>
            <option value="assigned">Acknowledged</option>
            <option value="responding">Responding</option>
            <option value="resolved">Closed</option>
            <option value="escalated">Escalated</option>
          </select>
        </label>
        {tipsQuery.isError && (
          <span className="text-sm text-red-400">
            {tipsQuery.error instanceof Error ? tipsQuery.error.message : "Failed to load tips"}
          </span>
        )}
        {mutate.isError && (
          <span className="text-sm text-red-400">
            {mutate.error instanceof Error ? mutate.error.message : "Action failed"}
          </span>
        )}
      </div>

      {/* Tips list */}
      {tipsQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading tips…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No tips match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              isExpanded={expandedId === tip.id}
              canWrite={canWrite}
              isActing={mutate.isPending}
              onToggle={() => setExpandedId(expandedId === tip.id ? null : tip.id)}
              onAck={() => mutate.mutate({ type: "ack", id: tip.id })}
              onClose={() => mutate.mutate({ type: "close", id: tip.id })}
              onEscalate={() => mutate.mutate({ type: "escalate", id: tip.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tip Card ─────────────────────────────────────────────────────────────────

interface TipCardProps {
  tip: CampusIncident;
  isExpanded: boolean;
  canWrite: boolean;
  isActing: boolean;
  onToggle: () => void;
  onAck: () => void;
  onClose: () => void;
  onEscalate: () => void;
}

function TipCard({
  tip,
  isExpanded,
  canWrite,
  isActing,
  onToggle,
  onAck,
  onClose,
  onEscalate,
}: TipCardProps) {
  const badge = STATUS_BADGE[tip.status] ?? STATUS_BADGE.open;
  const isOpen = tip.status === "open";
  const isResolved = tip.status === "resolved" || tip.status === "escalated";

  return (
    <div
      className={`rounded-lg border bg-slate-800/60 transition-colors ${
        isOpen
          ? "border-red-800/50 bg-red-950/10"
          : "border-slate-700/50"
      }`}
    >
      {/* Summary row */}
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="mt-0.5 shrink-0">
          {isOpen ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : (
            <MessageSquare className="h-4 w-4 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">
              {TYPE_LABELS[tip.type] ?? tip.type}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-400">
              {SOURCE_LABELS[tip.source] ?? tip.source}
            </span>
            {tip.confidential && (
              <span className="rounded-full border border-amber-700/50 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300">
                Confidential
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{formatRelativeTime(tip.createdAt)}</span>
            {tip.buildingCode && tip.buildingCode !== "UNKNOWN" && (
              <span>Building: {tip.buildingCode}</span>
            )}
            {tip.roomCode && <span>Room: {tip.roomCode}</span>}
            {tip.zoneCode && <span>Zone: {tip.zoneCode}</span>}
          </div>
          {tip.description && !isExpanded && (
            <p className="mt-1 truncate text-sm text-slate-300">{tip.description}</p>
          )}
        </div>
        <span className="ml-2 shrink-0 text-xs text-slate-500">
          {isExpanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3 space-y-3">
          {tip.description && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Report details
              </p>
              <p className="mt-1 text-sm text-slate-200">{tip.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400 sm:grid-cols-3">
            <span>
              <span className="text-slate-500">ID: </span>{tip.id.slice(0, 12)}…
            </span>
            <span>
              <span className="text-slate-500">Source: </span>
              {SOURCE_LABELS[tip.source] ?? tip.source}
            </span>
            <span>
              <span className="text-slate-500">Type: </span>{TYPE_LABELS[tip.type] ?? tip.type}
            </span>
            {tip.assignedTo && (
              <span>
                <span className="text-slate-500">Assigned: </span>
                {tip.assignedToName ?? tip.assignedTo}
              </span>
            )}
            <span>
              <span className="text-slate-500">Received: </span>
              {new Date(tip.createdAt).toLocaleString()}
            </span>
          </div>

          {/* AI safety note */}
          <div className="flex items-start gap-2 rounded-md border border-slate-700/50 bg-slate-900/60 px-3 py-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <p className="text-xs text-slate-500">
              NexCort iQ never makes disciplinary decisions or identifies individuals. Human staff
              evaluate each report and determine the appropriate response.
            </p>
          </div>

          {/* Actions */}
          {canWrite && !isResolved && (
            <div className="flex flex-wrap gap-2 pt-1">
              {isOpen && (
                <button
                  onClick={onAck}
                  disabled={isActing}
                  className="rounded-md border border-yellow-700/50 bg-yellow-900/30 px-3 py-1.5 text-xs font-medium text-yellow-200 hover:bg-yellow-900/50 disabled:opacity-50"
                >
                  Acknowledge
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isActing}
                className="rounded-md border border-green-700/50 bg-green-900/30 px-3 py-1.5 text-xs font-medium text-green-200 hover:bg-green-900/50 disabled:opacity-50"
              >
                Mark Resolved
              </button>
              <button
                onClick={onEscalate}
                disabled={isActing}
                className="rounded-md border border-purple-700/50 bg-purple-900/30 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-900/50 disabled:opacity-50"
              >
                Escalate to 911
              </button>
            </div>
          )}
          {isResolved && (
            <p className="text-xs text-slate-500 italic">
              This report is {tip.status}. No further actions available.
            </p>
          )}
          {!canWrite && !isResolved && (
            <p className="text-xs text-slate-500 italic">
              View only — contact an admin or supervisor to take action.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
