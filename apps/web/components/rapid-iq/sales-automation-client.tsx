"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RapidIqSalesBulkBatch,
  RapidIqSalesContentDraft,
  RapidIqSalesOutreachStep,
  RapidIqSalesSequence,
  RapidIqSalesStepStatus,
  RapidIqSalesVertical,
} from "rapid-cortex-shared";
import {
  SALES_AUTOMATION_CAMPAIGNS_QUERY_KEY,
  SALES_AUTOMATION_DRAFTS_QUERY_KEY,
  SALES_AUTOMATION_METRICS_QUERY_KEY,
  SALES_AUTOMATION_OUTLOOK_QUERY_KEY,
  SALES_AUTOMATION_SEQUENCES_QUERY_KEY,
  approveSalesBulkCampaign,
  approveSalesDraft,
  approveSalesSequence,
  connectSalesOutlook,
  createSalesBulkCampaign,
  createSalesSequence,
  disconnectSalesOutlook,
  getSalesMetrics,
  getSalesOutlookStatus,
  listSalesCampaigns,
  listSalesDrafts,
  listSalesSequences,
  suppressSalesSequence,
  updateSalesBulkCopy,
  updateSalesDraft,
  updateSalesSequence,
} from "@/lib/rapid-iq/sales-automation-api";
import { parseCampaignCsv } from "@/lib/rapid-iq/parse-campaign-csv";

type Tab = "queue" | "active" | "content" | "campaigns";

const VERTICAL_BADGE: Record<string, string> = {
  PSAP: "bg-sky-500/10 text-sky-300",
  CAMPUS: "bg-violet-500/10 text-violet-300",
  VENUE: "bg-amber-500/10 text-amber-300",
  HOSPITAL: "bg-teal-500/10 text-teal-300",
  TRANSIT: "bg-emerald-500/10 text-emerald-300",
  ALL: "bg-slate-700/50 text-slate-400",
};

const TRIGGER_LABELS: Record<string, string> = {
  rfp_signal: "RFP signal",
  new_lead: "New lead",
  stage_advance: "Stage change",
  campaign: "Campaign",
  newsletter: "Newsletter",
};

const STEP_MARK: Record<RapidIqSalesStepStatus, string> = {
  pending: "○",
  scheduled: "◷",
  sent: "✓",
  opened: "●",
  clicked: "→",
  replied: "↩",
  skipped: "–",
};

const STEP_COLOR: Record<RapidIqSalesStepStatus, string> = {
  pending: "text-slate-500",
  scheduled: "text-sky-400",
  sent: "text-slate-300",
  opened: "text-emerald-400",
  clicked: "text-violet-400",
  replied: "text-emerald-300",
  skipped: "text-slate-600",
};

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#071224] px-4 py-3">
      <div className={`text-2xl font-bold tabular-nums ${accent ?? "text-slate-100"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-slate-600">{sub}</div> : null}
    </div>
  );
}

function StepPips({ steps }: { steps: RapidIqSalesOutreachStep[] }) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {steps.map((step) => (
        <div key={step.stepId} className="flex items-center gap-1">
          <span className={`text-[11px] font-bold ${STEP_COLOR[step.status]}`}>
            {STEP_MARK[step.status]}
          </span>
          <span className="text-[9px] text-slate-600">{step.stepNumber}</span>
        </div>
      ))}
    </div>
  );
}

function SequenceCard({
  seq,
  busyId,
  onApprove,
  onSuppress,
  onPreview,
}: {
  seq: RapidIqSalesSequence;
  busyId: string | null;
  onApprove: (id: string) => void;
  onSuppress: (id: string) => void;
  onPreview: (seq: RapidIqSalesSequence) => void;
}) {
  const isDraft = seq.status === "draft";
  const rfpDaysLeft = seq.attribution.rfpDeadline
    ? Math.ceil((Date.parse(seq.attribution.rfpDeadline) - Date.now()) / 86_400_000)
    : null;
  const busy = busyId === seq.sequenceId;

  return (
    <div
      className={`rounded-lg border bg-[#071224] p-3 ${
        isDraft ? "border-amber-500/30" : "border-white/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                VERTICAL_BADGE[seq.vertical] ?? "bg-slate-700/50 text-slate-400"
              }`}
            >
              {seq.vertical}
            </span>
            <span className="text-[10px] text-slate-500">
              {TRIGGER_LABELS[seq.triggerType] ?? seq.triggerType}
            </span>
            {isDraft ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                AWAITING APPROVAL
              </span>
            ) : null}
            {seq.status === "active" ? (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                ACTIVE
              </span>
            ) : null}
            {seq.status === "suppressed" ? (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                SUPPRESSED
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-100">{seq.agencyName}</div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500">
            {seq.recipientName ?? seq.recipientEmail}
          </div>
          {rfpDaysLeft !== null ? (
            <div
              className={`mt-0.5 text-[10px] font-medium ${
                rfpDaysLeft <= 7 ? "text-red-400" : rfpDaysLeft <= 14 ? "text-amber-400" : "text-slate-600"
              }`}
            >
              {rfpDaysLeft <= 0 ? "RFP overdue" : `RFP in ${rfpDaysLeft}d`}
            </div>
          ) : null}
          <StepPips steps={seq.steps} />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onPreview(seq)}
            className="rounded border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400 hover:border-sky-500 hover:text-sky-300"
          >
            Review & edit
          </button>
          {isDraft ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onApprove(seq.sequenceId)}
                className="rounded bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busy ? "…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSuppress(seq.sequenceId)}
                className="rounded border border-slate-700 px-2.5 py-1 text-[10px] text-slate-500 hover:border-red-500 hover:text-red-300 disabled:opacity-50"
              >
                Suppress
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContentDraftCard({
  draft,
  busyId,
  onApprove,
  onSave,
}: {
  draft: RapidIqSalesContentDraft;
  busyId: string | null;
  onApprove: (id: string) => void;
  onSave: (id: string, patch: { subject: string; bodyText: string; linkedinText: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [bodyText, setBodyText] = useState(draft.bodyText);
  const [linkedinText, setLinkedinText] = useState(draft.linkedinText ?? "");
  const busy = busyId === draft.draftId;
  const canEdit = draft.status === "draft";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#071224] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
              {draft.contentType.replace(/_/g, " ").toUpperCase()}
            </span>
            {draft.weekOf ? <span className="text-[10px] text-slate-500">Week of {draft.weekOf}</span> : null}
            {draft.status !== "draft" ? (
              <span className="text-[9px] font-bold uppercase text-emerald-400">{draft.status}</span>
            ) : null}
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
                placeholder="Subject"
              />
              <textarea
                rows={10}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-[12px] leading-relaxed text-slate-200"
              />
              <textarea
                rows={4}
                value={linkedinText}
                onChange={(e) => setLinkedinText(e.target.value)}
                placeholder="LinkedIn version (optional)"
                className="w-full rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[12px] leading-relaxed text-slate-200"
              />
            </div>
          ) : (
            <>
              <div className="mt-1 truncate text-sm font-semibold text-slate-100">
                {draft.subject ?? "Untitled draft"}
              </div>
              <div
                className={`mt-1.5 overflow-hidden text-[11px] leading-relaxed text-slate-400 ${
                  expanded ? "" : "line-clamp-3"
                }`}
              >
                {draft.bodyText}
              </div>
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 text-[10px] text-sky-500 hover:text-sky-300"
              >
                {expanded ? "Collapse" : "Read full draft"}
              </button>
              {draft.linkedinText && expanded ? (
                <div className="mt-3 rounded border border-sky-500/20 bg-sky-500/5 p-2.5">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-sky-400">
                    LinkedIn version
                  </div>
                  <div className="text-[11px] leading-relaxed text-slate-400">{draft.linkedinText}</div>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {canEdit && !editing ? (
            <button
              type="button"
              onClick={() => {
                setSubject(draft.subject ?? "");
                setBodyText(draft.bodyText);
                setLinkedinText(draft.linkedinText ?? "");
                setEditing(true);
                setExpanded(true);
              }}
              className="rounded border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400 hover:border-sky-500 hover:text-sky-300"
            >
              Edit
            </button>
          ) : null}
          {editing ? (
            <>
              <button
                type="button"
                disabled={busy || !bodyText.trim()}
                onClick={() =>
                  onSave(draft.draftId, {
                    subject: subject.trim(),
                    bodyText: bodyText.trim(),
                    linkedinText: linkedinText.trim(),
                  })
                }
                className="rounded bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busy ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-slate-700 px-2.5 py-1 text-[10px] text-slate-500"
              >
                Cancel
              </button>
            </>
          ) : null}
          {canEdit && !editing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove(draft.draftId)}
              className="rounded bg-emerald-700 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy ? "…" : "Approve draft"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function canEditStepStatus(status: RapidIqSalesStepStatus): boolean {
  return status === "pending" || status === "scheduled";
}

function toLocalDateTimeInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function PreviewModal({
  seq,
  busy,
  onClose,
  onApprove,
  onSave,
  bulkCount,
}: {
  seq: RapidIqSalesSequence;
  busy: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onSave: (
    id: string,
    patch: {
      recipientEmail: string;
      recipientName: string;
      steps: {
        stepNumber: 1 | 2 | 3;
        email: { subject: string; bodyText: string };
        scheduledAt?: string;
      }[];
    },
  ) => void;
  bulkCount?: number;
}) {
  const [recipientEmail, setRecipientEmail] = useState(seq.recipientEmail);
  const [recipientName, setRecipientName] = useState(seq.recipientName ?? "");
  const [edits, setEdits] = useState(
    seq.steps.map((step) => ({
      stepNumber: step.stepNumber,
      subject: step.email.subject,
      bodyText: step.email.bodyText,
      scheduledAt: toLocalDateTimeInput(step.scheduledAt),
    })),
  );

  useEffect(() => {
    setRecipientEmail(seq.recipientEmail);
    setRecipientName(seq.recipientName ?? "");
    setEdits(
      seq.steps.map((step) => ({
        stepNumber: step.stepNumber,
        subject: step.email.subject,
        bodyText: step.email.bodyText,
        scheduledAt: toLocalDateTimeInput(step.scheduledAt),
      })),
    );
  }, [seq]);

  const anySent = seq.steps.some((s) => !canEditStepStatus(s.status) && s.status !== "skipped");
  const canSave = seq.status === "draft" || seq.status === "active" || seq.status === "approved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-[#050c1a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div>
            <div className="text-sm font-bold text-slate-100">{seq.agencyName}</div>
            <div className="text-[11px] text-slate-500">
              {bulkCount
                ? `This exact copy is saved on every draft in the batch (${bulkCount})`
                : `${seq.steps.length} emails · ${TRIGGER_LABELS[seq.triggerType]} · edit auto-generated copy before it sends`}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-slate-500 hover:text-slate-300">
            ×
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {bulkCount ? null : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Recipient email
              <input
                type="email"
                value={recipientEmail}
                disabled={anySent}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white disabled:opacity-60"
              />
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Recipient name
              <input
                value={recipientName}
                disabled={anySent}
                onChange={(e) => setRecipientName(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white disabled:opacity-60"
              />
            </label>
          </div>
          )}
          {seq.steps.map((step, index) => {
            const edit = edits[index];
            const locked = !canEditStepStatus(step.status);
            return (
              <div key={step.stepId} className="rounded-lg border border-white/[0.06] bg-[#071224] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    Step {step.stepNumber}
                  </span>
                  {step.delayDays > 0 ? (
                    <span className="text-[9px] text-slate-600">Default +{step.delayDays}d</span>
                  ) : (
                    <span className="text-[9px] text-slate-600">Email 1</span>
                  )}
                  <span className={`text-[9px] ${STEP_COLOR[step.status]}`}>{step.status.toUpperCase()}</span>
                  {locked ? <span className="text-[9px] text-slate-600">locked after send</span> : null}
                </div>
                {locked || !edit ? (
                  <>
                    {step.scheduledAt ? (
                      <div className="mb-1.5 text-[10px] text-slate-500">
                        Scheduled {new Date(step.scheduledAt).toLocaleString()}
                      </div>
                    ) : null}
                    <div className="mb-1.5 text-xs font-semibold text-sky-300">{step.email.subject}</div>
                    <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                      {step.email.bodyText}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Send at
                      <input
                        type="datetime-local"
                        value={edit.scheduledAt}
                        onChange={(e) =>
                          setEdits((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, scheduledAt: e.target.value } : row)),
                          )
                        }
                        className="mt-1 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-xs text-slate-200"
                      />
                    </label>
                    <input
                      value={edit.subject}
                      onChange={(e) =>
                        setEdits((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, subject: e.target.value } : row)),
                        )
                      }
                      className="mb-2 w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-xs font-semibold text-sky-300"
                    />
                    <textarea
                      rows={8}
                      value={edit.bodyText}
                      onChange={(e) =>
                        setEdits((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, bodyText: e.target.value } : row)),
                        )
                      }
                      className="w-full rounded-md border border-white/10 bg-[#050c1a] px-3 py-2 text-[12px] leading-relaxed text-slate-200"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
          {canSave ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onSave(seq.sequenceId, {
                  recipientEmail: recipientEmail.trim(),
                  recipientName: recipientName.trim(),
                  steps: seq.steps
                    .filter((step) => canEditStepStatus(step.status))
                    .map((step) => {
                      const edit = edits.find((e) => e.stepNumber === step.stepNumber);
                      return {
                        stepNumber: step.stepNumber,
                        email: {
                          subject: (edit?.subject ?? step.email.subject).trim(),
                          bodyText: (edit?.bodyText ?? step.email.bodyText).trim(),
                        },
                        scheduledAt: fromLocalDateTimeInput(edit?.scheduledAt ?? "") ?? "",
                      };
                    }),
                })
              }
              className="rounded border border-sky-700 px-4 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-900/40 disabled:opacity-50"
            >
              {busy ? "Saving…" : bulkCount ? `Save for ${bulkCount} drafts` : "Save edits"}
            </button>
          ) : null}
          {seq.status === "draft" && !bulkCount ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove(seq.sequenceId)}
              className="rounded bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Approve & schedule
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BulkBatchCard({
  campaignId,
  name,
  vertical,
  count,
  busy,
  onApprove,
  onEditCopy,
}: {
  campaignId: string;
  name: string;
  vertical: string;
  count: number;
  busy: boolean;
  onApprove: (campaignId: string) => void;
  onEditCopy: (campaignId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-sky-500/30 bg-[#071224] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${VERTICAL_BADGE[vertical] ?? "bg-slate-700/50 text-slate-400"}`}>
              {vertical}
            </span>
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
              BULK · {count} recipients
            </span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-100">{name}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            One approval sends email 1 from Outlook for the whole list. Follow-ups stay on days 5 and 12.
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onEditCopy(campaignId)}
            className="rounded border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400 hover:border-sky-500 hover:text-sky-300"
          >
            Edit copy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(campaignId)}
            className="rounded bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "…" : `Approve ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TriggerModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    agencyName: string;
    recipientEmail: string;
    recipientName: string;
    vertical: RapidIqSalesVertical;
    sendAt: string;
  }) => void;
}) {
  const [agencyName, setAgencyName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [vertical, setVertical] = useState<RapidIqSalesVertical>("PSAP");
  const [sendAt, setSendAt] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        className="w-full max-w-md rounded-xl border border-slate-700 bg-[#050c1a] p-5 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ agencyName, recipientEmail, recipientName, vertical, sendAt });
        }}
      >
        <div className="text-sm font-bold text-slate-100">Draft campaign sequence</div>
        <p className="mt-1 text-[11px] text-slate-500">
          Creates a 3-touch campaign. Set a send time or leave blank and schedule later. Nothing
          sends until you approve.
        </p>
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Agency
          <input
            required
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Recipient email
          <input
            required
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Recipient name
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Vertical
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value as RapidIqSalesVertical)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          >
            <option value="PSAP">PSAP</option>
            <option value="CAMPUS">Campus</option>
            <option value="VENUE">Venue</option>
            <option value="HOSPITAL">Hospital</option>
            <option value="TRANSIT">Transit</option>
          </select>
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Send email 1 at
          <input
            type="datetime-local"
            value={sendAt}
            onChange={(e) => setSendAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-4 py-1.5 text-xs text-slate-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Drafting…" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BulkCampaignModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    vertical: RapidIqSalesVertical;
    campaignName: string;
    recipients: { email: string; agencyName: string; recipientName?: string }[];
    sendAt: string;
  }) => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [vertical, setVertical] = useState<RapidIqSalesVertical>("PSAP");
  const [csv, setCsv] = useState("");
  const [sendAt, setSendAt] = useState("");
  const parsed = parseCampaignCsv(csv);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#050c1a] p-5 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed.rows.length === 0) return;
          onSubmit({
            vertical,
            campaignName: campaignName.trim(),
            recipients: parsed.rows,
            sendAt,
          });
        }}
      >
        <div className="text-sm font-bold text-slate-100">Campaign to 100 addresses</div>
        <p className="mt-1 text-[11px] text-slate-500">
          Paste up to 100 rows (max 500). Columns: email, agency name, contact name (optional). Set
          a send time, edit copy, then approve. One approval can send email 1 to 100 addresses.
        </p>
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Campaign name
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="911 Core outbound — Sept 2026"
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Vertical
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value as RapidIqSalesVertical)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          >
            <option value="PSAP">PSAP</option>
            <option value="CAMPUS">Campus</option>
            <option value="VENUE">Venue</option>
            <option value="HOSPITAL">Hospital</option>
            <option value="TRANSIT">Transit</option>
          </select>
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Send email 1 at
          <input
            type="datetime-local"
            value={sendAt}
            onChange={(e) => setSendAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Recipient list
          <textarea
            required
            rows={10}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"email,agency_name,recipient_name\ndirector@psap.gov,Metro PSAP,Alex Rivera"}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#071224] px-3 py-2 font-mono text-[11px] text-white"
          />
        </label>
        <div className="mt-2 text-[11px] text-slate-400">
          {parsed.rows.length} ready
          {parsed.errors.length > 0 ? ` · ${parsed.errors.length} skipped` : ""}
          {parsed.truncated ? " · truncated at 500" : ""}
        </div>
        {parsed.errors.length > 0 ? (
          <div className="mt-1 max-h-16 overflow-y-auto text-[10px] text-amber-400">
            {parsed.errors.slice(0, 8).join(" · ")}
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-4 py-1.5 text-xs text-slate-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || parsed.rows.length === 0}
            className="rounded bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Queuing…" : `Queue ${parsed.rows.length} drafts`}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SalesAutomationClient() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const [preview, setPreview] = useState<RapidIqSalesSequence | null>(null);
  const [bulkEdit, setBulkEdit] = useState<RapidIqSalesSequence | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sequencesQ = useQuery({
    queryKey: SALES_AUTOMATION_SEQUENCES_QUERY_KEY,
    queryFn: listSalesSequences,
  });
  const draftsQ = useQuery({
    queryKey: SALES_AUTOMATION_DRAFTS_QUERY_KEY,
    queryFn: listSalesDrafts,
  });
  const campaignsQ = useQuery({
    queryKey: SALES_AUTOMATION_CAMPAIGNS_QUERY_KEY,
    queryFn: listSalesCampaigns,
  });
  const metricsQ = useQuery({
    queryKey: SALES_AUTOMATION_METRICS_QUERY_KEY,
    queryFn: getSalesMetrics,
  });
  const outlookQ = useQuery({
    queryKey: SALES_AUTOMATION_OUTLOOK_QUERY_KEY,
    queryFn: getSalesOutlookStatus,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_SEQUENCES_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_DRAFTS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_METRICS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_OUTLOOK_QUERY_KEY });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("outlook") !== "connected") return;
    showToast("Outlook connected — campaign emails will send from that mailbox");
    window.history.replaceState({}, "", "/rc-admin/sales-automation");
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_OUTLOOK_QUERY_KEY });
  }, [qc]);

  const approveSeq = useMutation({
    mutationFn: approveSalesSequence,
    onMutate: (id) => {
      setBusyId(id);
      setError(null);
    },
    onSuccess: (seq) => {
      invalidate();
      setPreview(null);
      showToast(
        seq.status === "suppressed"
          ? `Held: ${seq.suppressedReason ?? "suppressed"}`
          : "Campaign approved — email 1 sends from Outlook now; follow-ups stay scheduled",
      );
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const suppressSeq = useMutation({
    mutationFn: suppressSalesSequence,
    onMutate: (id) => {
      setBusyId(id);
      setError(null);
    },
    onSuccess: () => {
      invalidate();
      showToast("Sequence suppressed");
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const approveDraft = useMutation({
    mutationFn: approveSalesDraft,
    onMutate: (id) => {
      setBusyId(id);
      setError(null);
    },
    onSuccess: () => {
      invalidate();
      showToast("Draft marked approved. Newsletter list send is not wired — copy from the draft if needed.");
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const saveSeq = useMutation({
    mutationFn: ({
      sequenceId,
      patch,
    }: {
      sequenceId: string;
      patch: Parameters<typeof updateSalesSequence>[1];
    }) => updateSalesSequence(sequenceId, patch),
    onMutate: ({ sequenceId }) => {
      setBusyId(sequenceId);
      setError(null);
    },
    onSuccess: (seq) => {
      invalidate();
      setPreview(seq);
      showToast("Email copy saved");
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const saveDraft = useMutation({
    mutationFn: ({
      draftId,
      patch,
    }: {
      draftId: string;
      patch: { subject: string; bodyText: string; linkedinText: string };
    }) => updateSalesDraft(draftId, patch),
    onMutate: ({ draftId }) => {
      setBusyId(draftId);
      setError(null);
    },
    onSuccess: () => {
      invalidate();
      showToast("Draft copy saved");
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const saveBulkCopy = useMutation({
    mutationFn: ({
      campaignId,
      steps,
    }: {
      campaignId: string;
      steps: Parameters<typeof updateSalesBulkCopy>[1];
    }) => updateSalesBulkCopy(campaignId, steps),
    onMutate: ({ campaignId }) => {
      setBusyId(campaignId);
      setError(null);
    },
    onSuccess: (result) => {
      invalidate();
      setBulkEdit(null);
      showToast(`Updated copy on ${result.updated} draft sequences`);
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const connectOutlook = useMutation({
    mutationFn: connectSalesOutlook,
    onMutate: () => setError(null),
    onSuccess: (body) => {
      if (body.authorizeUrl) {
        window.location.href = body.authorizeUrl;
        return;
      }
      invalidate();
      showToast(
        body.mock
          ? `Outlook mock connected as ${body.mailbox ?? "hello@nexcortiq.us"} — live Graph send is off`
          : `Outlook connected as ${body.mailbox ?? "sales mailbox"}`,
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  const disconnectOutlook = useMutation({
    mutationFn: disconnectSalesOutlook,
    onMutate: () => setError(null),
    onSuccess: () => {
      invalidate();
      showToast("Outlook disconnected — campaign emails will not send from that mailbox");
    },
    onError: (err: Error) => setError(err.message),
  });

  const createSeq = useMutation({
    mutationFn: createSalesSequence,
    onMutate: () => setError(null),
    onSuccess: (seq) => {
      invalidate();
      setTriggerOpen(false);
      showToast(
        seq.status === "suppressed"
          ? `Draft held: ${seq.suppressedReason ?? "suppressed"}`
          : "Campaign draft queued for approval",
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  const createBulk = useMutation({
    mutationFn: createSalesBulkCampaign,
    onMutate: () => setError(null),
    onSuccess: (result) => {
      invalidate();
      setBulkOpen(false);
      showToast(
        `${result.created} drafts queued` +
          (result.suppressed ? ` · ${result.suppressed} suppressed` : "") +
          (result.duplicates ? ` · ${result.duplicates} duplicates skipped` : ""),
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  const approveBulk = useMutation({
    mutationFn: approveSalesBulkCampaign,
    onMutate: (id) => {
      setBusyId(id);
      setError(null);
    },
    onSuccess: (result) => {
      invalidate();
      showToast(
        `Approved ${result.approved} · ${result.sentNow} sending now` +
          (result.sentNow < result.approved
            ? ". Remaining due mail goes out on the 15-minute worker (up to 100 per run)."
            : ""),
      );
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setBusyId(null),
  });

  const sequences = sequencesQ.data ?? [];
  const drafts = draftsQ.data ?? [];
  const pendingSeqs = sequences.filter((s) => s.status === "draft");
  const activeSeqs = sequences.filter((s) => s.status === "active");
  const pendingDrafts = drafts.filter((d) => d.status === "draft");
  const metrics = metricsQ.data;
  const pendingGrouped = useMemo(() => {
    const batches = new Map<string, RapidIqSalesSequence[]>();
    const singles: RapidIqSalesSequence[] = [];
    for (const seq of pendingSeqs) {
      const campaignId = seq.attribution.campaignId?.trim();
      if (!campaignId) {
        singles.push(seq);
        continue;
      }
      const list = batches.get(campaignId) ?? [];
      list.push(seq);
      batches.set(campaignId, list);
    }
    return { batches: [...batches.entries()], singles };
  }, [pendingSeqs]);

  const tabs = useMemo(
    () =>
      [
        { id: "queue" as const, label: "Approval queue", count: pendingSeqs.length + pendingDrafts.length },
        { id: "active" as const, label: "Active sequences", count: activeSeqs.length },
        { id: "content" as const, label: "Content drafts", count: pendingDrafts.length },
        { id: "campaigns" as const, label: "Campaigns" },
      ] satisfies { id: Tab; label: string; count?: number }[],
    [pendingSeqs.length, pendingDrafts.length, activeSeqs.length],
  );

  const loading = sequencesQ.isLoading || draftsQ.isLoading || metricsQ.isLoading;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#050c1a] text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">
            Campaigns send from <span className="text-slate-300">hello@nexcortiq.us</span>. Queue up
            to 100 addresses, edit copy, and pick a send time for each email. Approval sends due mail
            immediately (100 at a time).
          </p>
          {outlookQ.data?.connected ? (
            <p className="mt-1 text-[11px] text-emerald-400">
              Sending from {outlookQ.data.mailbox}
              {outlookQ.data.mock ? " (mock — Graph send is off)" : ""}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-amber-400">
              Connect Outlook as hello@nexcortiq.us. Until then, approved mail is logged only or
              sent via SES fallback.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {outlookQ.data?.connected ? (
            <button
              type="button"
              disabled={disconnectOutlook.isPending}
              onClick={() => disconnectOutlook.mutate()}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            >
              Disconnect Outlook
            </button>
          ) : (
            <button
              type="button"
              disabled={connectOutlook.isPending}
              onClick={() => connectOutlook.mutate()}
              className="rounded border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-900/40 disabled:opacity-50"
            >
              {connectOutlook.isPending ? "Connecting…" : "Connect hello@nexcortiq.us"}
            </button>
          )}
          <button
            type="button"
            onClick={() => invalidate()}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-sky-500 hover:text-sky-300"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
          >
            Campaign to 100
          </button>
          <button
            type="button"
            onClick={() => setTriggerOpen(true)}
            className="rounded border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-900/40"
          >
            Single draft
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 bg-red-950/40 px-6 py-2 text-xs text-red-300">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 border-b border-white/[0.06] px-6 py-4 md:grid-cols-4 lg:grid-cols-7">
        <MetricTile label="Pending approval" value={metrics?.pendingApprovals ?? "—"} accent="text-amber-400" />
        <MetricTile label="Sequences" value={metrics?.sequencesThisWeek ?? "—"} sub="this week" />
        <MetricTile label="Emails sent" value={metrics?.emailsSent ?? "—"} sub="last 30 days" />
        <MetricTile label="Open rate" value={metrics ? `${metrics.openRate}%` : "—"} accent="text-emerald-400" />
        <MetricTile label="Reply rate" value={metrics ? `${metrics.replyRate}%` : "—"} />
        <MetricTile
          label="Meetings booked"
          value={metrics?.meetingsBooked ?? "—"}
          sub="not tracked yet"
          accent="text-sky-400"
        />
        <MetricTile
          label="RFP responses"
          value={metrics?.rfpResponsesInProgress ?? "—"}
          sub="in progress"
          accent="text-violet-400"
        />
      </div>

      <div className="flex gap-0 border-b border-white/[0.06] px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition ${
              tab === t.id
                ? "border-sky-400 text-sky-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  tab === t.id ? "bg-sky-500/20 text-sky-300" : "bg-slate-700 text-slate-400"
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? <div className="py-16 text-center text-sm text-slate-600">Loading…</div> : null}

        {!loading && tab === "queue" ? (
          <div className="space-y-6">
            {pendingGrouped.batches.length > 0 ? (
              <section>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Bulk campaigns — awaiting approval ({pendingGrouped.batches.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingGrouped.batches.map(([campaignId, seqs]) => (
                    <BulkBatchCard
                      key={campaignId}
                      campaignId={campaignId}
                      name={seqs[0]?.attribution.campaignName ?? campaignId}
                      vertical={seqs[0]?.vertical ?? "PSAP"}
                      count={seqs.length}
                      busy={busyId === campaignId}
                      onApprove={(id) => approveBulk.mutate(id)}
                      onEditCopy={() => {
                        if (seqs[0]) setBulkEdit(seqs[0]);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {pendingGrouped.singles.length > 0 ? (
              <section>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Single sequences — awaiting approval ({pendingGrouped.singles.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingGrouped.singles.map((seq) => (
                    <SequenceCard
                      key={seq.sequenceId}
                      seq={seq}
                      busyId={busyId}
                      onApprove={(id) => approveSeq.mutate(id)}
                      onSuppress={(id) => suppressSeq.mutate(id)}
                      onPreview={setPreview}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {pendingDrafts.length > 0 ? (
              <section>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Content drafts — awaiting approval ({pendingDrafts.length})
                </h2>
                <div className="space-y-3">
                  {pendingDrafts.map((d) => (
                    <ContentDraftCard
                      key={d.draftId}
                      draft={d}
                      busyId={busyId}
                      onApprove={(id) => approveDraft.mutate(id)}
                      onSave={(id, patch) => saveDraft.mutate({ draftId: id, patch })}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {pendingSeqs.length === 0 && pendingDrafts.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-600">
                Approval queue is clear. Campaign to 100 and Single draft land here first.
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "active" ? (
          <div>
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Active sequences ({activeSeqs.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {activeSeqs.map((seq) => (
                <SequenceCard
                  key={seq.sequenceId}
                  seq={seq}
                  busyId={busyId}
                  onApprove={(id) => approveSeq.mutate(id)}
                  onSuppress={(id) => suppressSeq.mutate(id)}
                  onPreview={setPreview}
                />
              ))}
            </div>
            {activeSeqs.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-600">No active sequences.</div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "content" ? (
          <div className="space-y-3">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Content library
            </h2>
            {drafts.map((d) => (
              <ContentDraftCard
                key={d.draftId}
                draft={d}
                busyId={busyId}
                onApprove={(id) => approveDraft.mutate(id)}
                onSave={(id, patch) => saveDraft.mutate({ draftId: id, patch })}
              />
            ))}
            {drafts.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-600">
                No drafts yet. The Monday composer writes Inside the Cortex here.
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "campaigns" ? (
          <div className="space-y-6">
            {(campaignsQ.data?.batches ?? []).length > 0 ? (
              <section>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Live bulk batches
                </h2>
                <div className="space-y-3">
                  {(campaignsQ.data?.batches ?? []).map((batch: RapidIqSalesBulkBatch) => (
                    <div
                      key={batch.campaignId}
                      className="flex items-center justify-between gap-4 rounded-lg border border-sky-500/20 bg-[#071224] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">{batch.campaignName}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {batch.vertical} · {batch.draftCount} draft · {batch.activeCount} sending ·{" "}
                          {batch.completedCount} done · {batch.suppressedCount} held
                        </div>
                      </div>
                      {batch.draftCount > 0 ? (
                        <button
                          type="button"
                          disabled={busyId === batch.campaignId}
                          onClick={() => approveBulk.mutate(batch.campaignId)}
                          className="shrink-0 rounded bg-sky-600 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50"
                        >
                          Approve {batch.draftCount}
                        </button>
                      ) : (
                        <div className="text-[10px] font-bold text-emerald-400">SENDING</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Scheduled campaigns
              </h2>
              {(campaignsQ.data?.campaigns ?? []).map((c) => (
                <div
                  key={c.id}
                  className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-[#071224] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                    <div className="mt-0.5 max-w-lg text-[11px] text-slate-500">{c.description}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-[10px] font-bold ${
                        c.status === "active"
                          ? "text-emerald-400"
                          : c.status === "pending"
                            ? "text-amber-400"
                            : "text-sky-400"
                      }`}
                    >
                      {c.status.toUpperCase()}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-600">Next: {c.next}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </div>

      {preview ? (
        <PreviewModal
          seq={preview}
          busy={busyId === preview.sequenceId}
          onClose={() => setPreview(null)}
          onApprove={(id) => approveSeq.mutate(id)}
          onSave={(id, patch) => saveSeq.mutate({ sequenceId: id, patch })}
        />
      ) : null}

      {bulkEdit?.attribution.campaignId ? (
        <PreviewModal
          seq={bulkEdit}
          busy={busyId === bulkEdit.attribution.campaignId}
          bulkCount={
            pendingGrouped.batches.find(([id]) => id === bulkEdit.attribution.campaignId)?.[1].length ?? 1
          }
          onClose={() => setBulkEdit(null)}
          onApprove={() => undefined}
          onSave={(_id, patch) =>
            saveBulkCopy.mutate({
              campaignId: bulkEdit.attribution.campaignId as string,
              steps: patch.steps,
            })
          }
        />
      ) : null}

      {triggerOpen ? (
        <TriggerModal
          busy={createSeq.isPending}
          onClose={() => setTriggerOpen(false)}
          onSubmit={(input) =>
            createSeq.mutate({
              type: "campaign",
              agencyName: input.agencyName.trim(),
              vertical: input.vertical,
              recipientEmail: input.recipientEmail.trim(),
              recipientName: input.recipientName.trim() || undefined,
              sendAt: fromLocalDateTimeInput(input.sendAt),
            })
          }
        />
      ) : null}

      {bulkOpen ? (
        <BulkCampaignModal
          busy={createBulk.isPending}
          onClose={() => setBulkOpen(false)}
          onSubmit={(input) =>
            createBulk.mutate({
              vertical: input.vertical,
              campaignName: input.campaignName || undefined,
              recipients: input.recipients,
              sendAt: fromLocalDateTimeInput(input.sendAt),
            })
          }
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 rounded-lg border border-emerald-500/30 bg-[#071224] px-4 py-2.5 text-sm text-emerald-300 shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
