"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
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
  SALES_AUTOMATION_SEQUENCES_QUERY_KEY,
  approveSalesDraft,
  approveSalesSequence,
  createSalesSequence,
  getSalesMetrics,
  listSalesCampaigns,
  listSalesDrafts,
  listSalesSequences,
  suppressSalesSequence,
} from "@/lib/rapid-iq/sales-automation-api";

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
            Preview
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
}: {
  draft: RapidIqSalesContentDraft;
  busyId: string | null;
  onApprove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const busy = busyId === draft.draftId;
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
        </div>
        {draft.status === "draft" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(draft.draftId)}
            className="shrink-0 rounded bg-emerald-700 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy ? "…" : "Approve draft"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PreviewModal({
  seq,
  busy,
  onClose,
  onApprove,
}: {
  seq: RapidIqSalesSequence;
  busy: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-[#050c1a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div>
            <div className="text-sm font-bold text-slate-100">{seq.agencyName}</div>
            <div className="text-[11px] text-slate-500">
              {seq.recipientEmail} · {seq.steps.length} emails · {TRIGGER_LABELS[seq.triggerType]}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-slate-500 hover:text-slate-300">
            ×
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {seq.steps.map((step) => (
            <div key={step.stepId} className="rounded-lg border border-white/[0.06] bg-[#071224] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Step {step.stepNumber}
                </span>
                {step.delayDays > 0 ? (
                  <span className="text-[9px] text-slate-600">Day +{step.delayDays}</span>
                ) : (
                  <span className="text-[9px] text-slate-600">Send immediately after approval</span>
                )}
                <span className={`text-[9px] ${STEP_COLOR[step.status]}`}>{step.status.toUpperCase()}</span>
              </div>
              <div className="mb-1.5 text-xs font-semibold text-sky-300">{step.email.subject}</div>
              <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                {step.email.bodyText}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
          {seq.status === "draft" ? (
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
  }) => void;
}) {
  const [agencyName, setAgencyName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [vertical, setVertical] = useState<RapidIqSalesVertical>("PSAP");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        className="w-full max-w-md rounded-xl border border-slate-700 bg-[#050c1a] p-5 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ agencyName, recipientEmail, recipientName, vertical });
        }}
      >
        <div className="text-sm font-bold text-slate-100">Draft outreach sequence</div>
        <p className="mt-1 text-[11px] text-slate-500">
          Creates a 3-touch draft. It will not send until you approve it.
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

export function SalesAutomationClient() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const [preview, setPreview] = useState<RapidIqSalesSequence | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
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

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_SEQUENCES_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_DRAFTS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: SALES_AUTOMATION_METRICS_QUERY_KEY });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

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
          : "Sequence approved — step 1 scheduled",
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

  const createSeq = useMutation({
    mutationFn: createSalesSequence,
    onMutate: () => setError(null),
    onSuccess: (seq) => {
      invalidate();
      setTriggerOpen(false);
      showToast(
        seq.status === "suppressed"
          ? `Draft held: ${seq.suppressedReason ?? "suppressed"}`
          : "Draft sequence queued for approval",
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  const sequences = sequencesQ.data ?? [];
  const drafts = draftsQ.data ?? [];
  const pendingSeqs = sequences.filter((s) => s.status === "draft");
  const activeSeqs = sequences.filter((s) => s.status === "active");
  const pendingDrafts = drafts.filter((d) => d.status === "draft");
  const metrics = metricsQ.data;

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
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <p className="text-[11px] text-slate-500">
          Human-in-the-loop SES from noreply@rapidcortex.us. Open/reply rates stay 0 until engagement
          tracking is wired.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => invalidate()}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-sky-500 hover:text-sky-300"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setTriggerOpen(true)}
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
          >
            Draft outreach
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
            {pendingSeqs.length > 0 ? (
              <section>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Outreach sequences — awaiting approval ({pendingSeqs.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingSeqs.map((seq) => (
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
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {pendingSeqs.length === 0 && pendingDrafts.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-600">
                Approval queue is clear. Composer jobs and Draft outreach land here first.
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
          <div className="space-y-4">
            <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Scheduled campaigns
            </h2>
            {(campaignsQ.data ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-[#071224] px-4 py-3"
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
          </div>
        ) : null}
      </div>

      {preview ? (
        <PreviewModal
          seq={preview}
          busy={busyId === preview.sequenceId}
          onClose={() => setPreview(null)}
          onApprove={(id) => approveSeq.mutate(id)}
        />
      ) : null}

      {triggerOpen ? (
        <TriggerModal
          busy={createSeq.isPending}
          onClose={() => setTriggerOpen(false)}
          onSubmit={(input) =>
            createSeq.mutate({
              type: "new_lead",
              agencyName: input.agencyName.trim(),
              vertical: input.vertical,
              recipientEmail: input.recipientEmail.trim(),
              recipientName: input.recipientName.trim() || undefined,
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
