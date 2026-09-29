"use client";

/**
 * VenueCaseWorkflow — RFP 2396IP, Build Item 2
 *
 * Renders the case lifecycle action panel on the venue incident detail page.
 * Shows current status badge, available actions based on current status, and
 * a condensed status history timeline.
 */

import { useState, useTransition } from "react";
import type { VenueCaseActionBody } from "rapid-cortex-shared";
import { performVenueCaseAction } from "@/lib/venue/venue-case-api";

export type CaseStatus =
  | "open"
  | "assigned"
  | "responding"
  | "pending_approval"
  | "approved"
  | "resolved"
  | "closed"
  | "escalated"
  | "reopened";

interface StatusHistoryEntry {
  at: string;
  from: string;
  to: string;
  actorLabel?: string;
  note?: string;
}

interface VenueCaseWorkflowProps {
  incidentId: string;
  currentStatus: CaseStatus;
  assignedLabel?: string | null;
  statusHistory?: StatusHistoryEntry[];
  /** Called after a successful action so parent can refresh incident data. */
  onStatusChanged?: (newStatus: string) => void;
}

// ─── Status display helpers ───────────────────────────────────────────────────

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  responding: "Responding",
  pending_approval: "Pending Approval",
  approved: "Approved",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
  reopened: "Reopened",
};

const STATUS_COLORS: Record<CaseStatus, string> = {
  open: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  assigned: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  responding: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  pending_approval: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  resolved: "bg-green-500/20 text-green-300 border-green-500/40",
  closed: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  escalated: "bg-red-500/20 text-red-300 border-red-500/40",
  reopened: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

// ─── Available actions per status ─────────────────────────────────────────────

type ActionDef = {
  action: VenueCaseActionBody["action"];
  label: string;
  requiresAssignee?: boolean;
  requiresNote?: boolean;
  variant?: "danger" | "primary" | "secondary";
};

const AVAILABLE_ACTIONS: Partial<Record<CaseStatus, ActionDef[]>> = {
  open: [
    { action: "assign", label: "Assign", requiresAssignee: true, variant: "primary" },
    { action: "escalate", label: "Escalate", requiresNote: true, variant: "danger" },
    { action: "close", label: "Close", variant: "secondary" },
  ],
  assigned: [
    { action: "investigate", label: "Start Responding", variant: "primary" },
    { action: "submit_for_approval", label: "Submit for Approval", variant: "secondary" },
    { action: "escalate", label: "Escalate", requiresNote: true, variant: "danger" },
    { action: "close", label: "Close", variant: "secondary" },
  ],
  responding: [
    { action: "submit_for_approval", label: "Submit for Approval", variant: "primary" },
    { action: "escalate", label: "Escalate", requiresNote: true, variant: "danger" },
    { action: "close", label: "Close", variant: "secondary" },
  ],
  pending_approval: [
    { action: "approve", label: "Approve", variant: "primary" },
    { action: "investigate", label: "Return to Responding", variant: "secondary" },
    { action: "escalate", label: "Escalate", requiresNote: true, variant: "danger" },
  ],
  approved: [
    { action: "close", label: "Close Case", variant: "primary" },
  ],
  resolved: [
    { action: "close", label: "Close", variant: "primary" },
    { action: "reopen", label: "Reopen", requiresNote: true, variant: "secondary" },
  ],
  closed: [
    { action: "reopen", label: "Reopen", requiresNote: true, variant: "secondary" },
  ],
  escalated: [
    { action: "assign", label: "Re-assign", requiresAssignee: true, variant: "primary" },
    { action: "investigate", label: "Start Responding", variant: "primary" },
    { action: "close", label: "Close", variant: "secondary" },
  ],
  reopened: [
    { action: "assign", label: "Assign", requiresAssignee: true, variant: "primary" },
    { action: "investigate", label: "Start Responding", variant: "primary" },
    { action: "escalate", label: "Escalate", requiresNote: true, variant: "danger" },
    { action: "close", label: "Close", variant: "secondary" },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VenueCaseWorkflow({
  incidentId,
  currentStatus,
  assignedLabel,
  statusHistory = [],
  onStatusChanged,
}: VenueCaseWorkflowProps) {
  const [status, setStatus] = useState<CaseStatus>(currentStatus);
  const [assignedTo, setAssignedTo] = useState(assignedLabel ?? "");
  const [pendingAction, setPendingAction] = useState<ActionDef | null>(null);
  const [note, setNote] = useState("");
  const [assigneeInput, setAssigneeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const actions = AVAILABLE_ACTIONS[status] ?? [];

  function handleActionClick(actionDef: ActionDef) {
    if (actionDef.requiresAssignee || actionDef.requiresNote) {
      setPendingAction(actionDef);
      setNote("");
      setAssigneeInput("");
      setError(null);
    } else {
      submitAction(actionDef, "", "");
    }
  }

  function submitAction(actionDef: ActionDef, noteVal: string, assigneeVal: string) {
    setError(null);
    startTransition(async () => {
      try {
        const body: VenueCaseActionBody = {
          action: actionDef.action,
          note: noteVal.trim() || undefined,
          assigneeId: assigneeVal.trim() || undefined,
          assigneeLabel: assigneeVal.trim() || undefined,
        };
        const result = await performVenueCaseAction(incidentId, body);
        setStatus(result.newStatus as CaseStatus);
        if (body.assigneeLabel) setAssignedTo(body.assigneeLabel);
        setPendingAction(null);
        onStatusChanged?.(result.newStatus);
      } catch (err) {
        setError((err as Error).message || "Action failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Case Status</h3>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {assignedTo && (
        <p className="text-xs text-slate-400">
          Assigned to <span className="text-white/80">{assignedTo}</span>
        </p>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={() => handleActionClick(a)}
              disabled={isPending}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                a.variant === "danger"
                  ? "bg-red-600/80 text-white hover:bg-red-600"
                  : a.variant === "primary"
                    ? "bg-orange-600 text-white hover:bg-orange-500"
                    : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Inline form for actions that need input */}
      {pendingAction && (
        <div className="rounded-md border border-white/10 bg-slate-700/50 p-3 space-y-3">
          <p className="text-sm font-medium text-white/90">{pendingAction.label}</p>

          {pendingAction.requiresAssignee && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Assignee name / ID</label>
              <input
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                placeholder="Officer Jane Smith"
                className="w-full rounded bg-slate-600 px-2.5 py-1.5 text-sm text-white placeholder-slate-400 border border-white/10 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          )}

          {pendingAction.requiresNote && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Note (required)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Reason / context..."
                className="w-full rounded bg-slate-600 px-2.5 py-1.5 text-sm text-white placeholder-slate-400 border border-white/10 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => submitAction(pendingAction, note, assigneeInput)}
              disabled={isPending}
              className="rounded px-3 py-1.5 text-xs font-medium bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Confirm"}
            </button>
            <button
              onClick={() => setPendingAction(null)}
              disabled={isPending}
              className="rounded px-3 py-1.5 text-xs font-medium bg-slate-600 text-slate-200 hover:bg-slate-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status history timeline */}
      {statusHistory.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-medium text-slate-400 mb-2">History</p>
          <ol className="space-y-1.5">
            {[...statusHistory].reverse().map((entry, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500/60" />
                <div>
                  <span className="text-white/70">
                    {STATUS_LABELS[entry.to as CaseStatus] ?? entry.to}
                  </span>
                  {entry.actorLabel && (
                    <span className="ml-1 text-slate-500">by {entry.actorLabel}</span>
                  )}
                  <span className="ml-1 text-slate-600">
                    · {new Date(entry.at).toLocaleString()}
                  </span>
                  {entry.note && <p className="mt-0.5 text-slate-500 italic">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
