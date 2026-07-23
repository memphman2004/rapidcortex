"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ACTIVE_PIPELINE_STAGES,
  CHANNEL_CONFIG,
  LOST_REASONS,
  SALES_LEAD_PACKAGE_SOLD_LABELS,
  STAGE_CONFIG,
  type LeadActivity,
  type LeadNote,
  type LeadVertical,
  type PatchSalesLeadCrmBody,
  type PipelineStage,
  type SalesLeadCrmRecord,
  type SalesLeadPackageSold,
} from "rapid-cortex-shared";
import type { AttributionSummary } from "./leads-api";
import { addActivity, addNote, updateLead } from "./leads-api";
import {
  channelShortLabel,
  formatDateTime,
  formatShortDate,
  getAvatarGradient,
  leadDisplayName,
  leadInitials,
  resolveLeadChannel,
  stageBadgeClasses,
  verticalLabel,
} from "./leads-utils";

type Tab = "details" | "activity" | "source";
type ComposerMode = "note" | "call" | "email" | "task";

type Props = {
  lead: SalesLeadCrmRecord;
  attributionSummary: AttributionSummary | undefined;
  onClose: () => void;
  onLeadUpdated: (lead: SalesLeadCrmRecord) => void;
  onOpenStageModal: () => void;
  focusNoteToken: number;
  activityTabToken: number;
};

const VERTICAL_OPTIONS: { value: LeadVertical; label: string }[] = [
  { value: "rc911", label: "RC 911" },
  { value: "campus", label: "Campus" },
  { value: "venue", label: "Venue" },
  { value: "hospital", label: "Hospital" },
  { value: "transit", label: "Transit" },
  { value: "unknown", label: "Unknown" },
];

const PACKAGE_OPTIONS = (Object.keys(SALES_LEAD_PACKAGE_SOLD_LABELS) as SalesLeadPackageSold[]).map(
  (value) => ({ value, label: SALES_LEAD_PACKAGE_SOLD_LABELS[value] }),
);

function StageProgress({ stage }: { stage: PipelineStage }) {
  const idx = ACTIVE_PIPELINE_STAGES.indexOf(stage);
  const activeIdx = idx >= 0 ? idx : stage === "WON" || stage === "LOST" ? ACTIVE_PIPELINE_STAGES.length - 1 : 0;

  return (
    <div className="mt-2.5">
      <div className="flex gap-0.5">
        {ACTIVE_PIPELINE_STAGES.map((s, i) => {
          let pip = "bg-slate-800";
          if (i < activeIdx) pip = "bg-sky-500";
          if (i === activeIdx) pip = "bg-emerald-500";
          if (stage === "WON") pip = "bg-emerald-500";
          if (stage === "LOST") pip = "bg-red-500";
          return <div key={s} className={`h-1 flex-1 rounded-sm ${pip}`} />;
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px]">
        <span className="font-semibold text-sky-400">{STAGE_CONFIG[stage].label.toUpperCase()}</span>
        <span className="text-slate-600">PILOT</span>
      </div>
    </div>
  );
}

function InlineField({
  label,
  value,
  placeholder,
  field,
  type = "text",
  options,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  field: keyof PatchSalesLeadCrmBody;
  type?: "text" | "number" | "date" | "tel" | "select";
  options?: { value: string; label: string }[];
  onSave: (field: keyof PatchSalesLeadCrmBody, value: string | number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    const prev = value.trim();
    if (next === prev) return;
    setStatus("saving");
    try {
      const parsed = type === "number" ? (next === "" ? 0 : Number(next)) : next;
      if (type === "number" && typeof parsed === "number" && Number.isNaN(parsed)) {
        setDraft(value);
        setStatus("error");
        return;
      }
      await onSave(field, parsed);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setDraft(value);
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <div className="mb-1.5 flex items-start">
      <span className="w-[100px] shrink-0 pt-0.5 text-[11px] text-slate-500">{label}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          type === "select" ? (
            <select
              ref={inputRef as RefObject<HTMLSelectElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              className="w-full rounded border border-sky-500 bg-slate-950 px-1.5 py-0.5 text-xs text-slate-100 outline-none"
            >
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef as RefObject<HTMLInputElement>}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                }
                if (e.key === "Escape") {
                  setDraft(value);
                  setEditing(false);
                }
              }}
              className="w-full rounded border border-sky-500 bg-slate-950 px-1.5 py-0.5 text-xs text-slate-100 outline-none"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={[
              "group w-full rounded px-1 py-0.5 text-left text-xs transition",
              value ? "text-slate-200" : "text-slate-600",
              "hover:bg-sky-500/10",
            ].join(" ")}
          >
            <span className="inline-flex w-full items-center justify-between gap-2">
              <span className="truncate">{value || placeholder}</span>
              <span className="invisible text-[10px] text-slate-500 group-hover:visible">✎</span>
            </span>
          </button>
        )}
        {status === "saving" && <span className="text-[9px] text-slate-500">Saving…</span>}
        {status === "saved" && <span className="text-[9px] text-emerald-400">✓ Saved</span>}
        {status === "error" && <span className="text-[9px] text-red-400">Save failed</span>}
      </div>
    </div>
  );
}

function activityIcon(type: LeadActivity["type"]): { icon: string; className: string } {
  switch (type) {
    case "stage_change":
      return { icon: "→", className: "bg-sky-500/15 text-sky-300" };
    case "note_added":
      return { icon: "📝", className: "bg-violet-500/15 text-violet-300" };
    case "call_logged":
      return { icon: "📞", className: "bg-emerald-500/15 text-emerald-300" };
    case "email_logged":
      return { icon: "✉️", className: "bg-amber-500/15 text-amber-300" };
    case "task_added":
      return { icon: "✅", className: "bg-cyan-500/15 text-cyan-300" };
    case "created":
      return { icon: "✦", className: "bg-sky-500/15 text-sky-300" };
    default:
      return { icon: "•", className: "bg-slate-500/15 text-slate-400" };
  }
}

function timelineItems(lead: SalesLeadCrmRecord): Array<
  | { kind: "activity"; at: string; activity: LeadActivity }
  | { kind: "note"; at: string; note: LeadNote }
> {
  const items: Array<
    | { kind: "activity"; at: string; activity: LeadActivity }
    | { kind: "note"; at: string; note: LeadNote }
  > = [];
  for (const a of lead.activities ?? []) {
    items.push({ kind: "activity", at: a.createdAt, activity: a });
  }
  for (const n of lead.notes ?? []) {
    const already =
      (lead.activities ?? []).some(
        (a) => a.type === "note_added" && a.description === n.text && a.createdAt === n.createdAt,
      );
    if (!already) items.push({ kind: "note", at: n.createdAt, note: n });
  }
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return items;
}

export function LeadDetailPanel({
  lead,
  attributionSummary,
  onClose,
  onLeadUpdated,
  onOpenStageModal,
  focusNoteToken,
  activityTabToken,
}: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [composer, setComposer] = useState<ComposerMode>("note");
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [callDirection, setCallDirection] = useState("outbound");
  const [callDuration, setCallDuration] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [emailTo, setEmailTo] = useState(lead.email);
  const [emailSubject, setEmailSubject] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTab("details");
    setText("");
    setPinned(false);
    setEmailTo(lead.email);
    setError(null);
  }, [lead.leadId, lead.email]);

  useEffect(() => {
    if (focusNoteToken > 0) {
      setTab("activity");
      setComposer("note");
      window.setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [focusNoteToken]);

  useEffect(() => {
    if (activityTabToken > 0) setTab("activity");
  }, [activityTabToken]);

  const channel = resolveLeadChannel(lead);
  const channelCfg = CHANNEL_CONFIG[channel];
  const display = leadDisplayName(lead);
  const state =
    lead.attribution?.ipRegion ??
    (typeof lead.requestedState === "string" ? lead.requestedState : null) ??
    (typeof lead.state === "string" ? lead.state : null);

  async function saveField(field: keyof PatchSalesLeadCrmBody, value: string | number) {
    const payload = { [field]: value } as PatchSalesLeadCrmBody;
    const updated = await updateLead(lead.leadId, payload);
    onLeadUpdated(updated);
  }

  async function submitComposer() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      let updated: SalesLeadCrmRecord;
      if (composer === "note") {
        updated = await addNote(lead.leadId, body, pinned);
      } else if (composer === "call") {
        updated = await addActivity(lead.leadId, "call_logged", body, {
          direction: callDirection,
          duration: callDuration,
          outcome: callOutcome,
        });
      } else if (composer === "email") {
        updated = await addActivity(lead.leadId, "email_logged", body, {
          to: emailTo,
          subject: emailSubject,
        });
      } else {
        updated = await addActivity(lead.leadId, "task_added", body, {
          dueDate: taskDue,
          priority: taskPriority,
        });
      }
      onLeadUpdated(updated);
      setText("");
      setPinned(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const items = timelineItems(lead);

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-slate-800 bg-slate-950/80">
      <div className="border-b border-slate-800 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: getAvatarGradient(lead.email) }}
          >
            {leadInitials(lead)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-slate-100">{display}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {[state, `Joined ${formatShortDate(lead.createdAt)}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded px-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ${stageBadgeClasses(lead.pipelineStage)}`}
              >
                ● {STAGE_CONFIG[lead.pipelineStage].label.toUpperCase()}
              </span>
              <span
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300"
              >
                {channelCfg.icon} {channelShortLabel(channel)}
              </span>
              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-300">
                {verticalLabel(lead.vertical)}
              </span>
            </div>
            <StageProgress stage={lead.pipelineStage} />
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 border-b border-slate-800 px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            setTab("activity");
            setComposer("call");
          }}
          className="flex-1 rounded border border-slate-800 px-1 py-1.5 text-[10px] font-semibold text-slate-500 hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-300"
        >
          📞 Log Call
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("activity");
            setComposer("email");
          }}
          className="flex-1 rounded border border-slate-800 px-1 py-1.5 text-[10px] font-semibold text-slate-500 hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-300"
        >
          ✉️ Log Email
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("activity");
            setComposer("task");
          }}
          className="flex-1 rounded border border-slate-800 px-1 py-1.5 text-[10px] font-semibold text-slate-500 hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-300"
        >
          📋 Task
        </button>
        <button
          type="button"
          onClick={onOpenStageModal}
          className="flex-[1.4] rounded border border-sky-500/40 px-1 py-1.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/10"
        >
          → Move Stage
        </button>
      </div>

      <div className="flex shrink-0 border-b border-slate-800 px-4">
        {(
          [
            ["details", "Details"],
            ["activity", `Activity (${items.length})`],
            ["source", "Source ★"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "-mb-px border-b-2 px-3 py-2 text-[11px] font-semibold",
              tab === id
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        {tab === "details" && (
          <>
            <section className="mb-4">
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Contact Information
              </h3>
              <InlineField
                label="First Name"
                field="firstName"
                value={lead.firstName ?? ""}
                placeholder="Click to edit"
                onSave={saveField}
              />
              <InlineField
                label="Last Name"
                field="lastName"
                value={lead.lastName ?? ""}
                placeholder="Click to edit"
                onSave={saveField}
              />
              <div className="mb-1.5 flex items-start">
                <span className="w-[100px] shrink-0 pt-0.5 text-[11px] text-slate-500">Email</span>
                <span className="truncate text-xs text-slate-200">{lead.email}</span>
              </div>
              <InlineField
                label="Phone"
                field="phone"
                type="tel"
                value={lead.phone ?? ""}
                placeholder="Click to edit"
                onSave={saveField}
              />
              <InlineField
                label="Title"
                field="title"
                value={lead.title ?? lead.role ?? ""}
                placeholder="Click to edit"
                onSave={saveField}
              />
              <InlineField
                label="Agency"
                field="agencyName"
                value={lead.agencyName ?? lead.agencyCompany ?? ""}
                placeholder="Click to edit"
                onSave={saveField}
              />
              <div className="mb-1.5 flex items-start">
                <span className="w-[100px] shrink-0 pt-0.5 text-[11px] text-slate-500">State</span>
                <span className={`text-xs ${state ? "text-slate-200" : "text-slate-600"}`}>
                  {state || "—"}
                </span>
              </div>
            </section>

            <section className="mb-4">
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Deal Intelligence
              </h3>
              <InlineField
                label="Vertical"
                field="vertical"
                type="select"
                value={lead.vertical ?? "unknown"}
                placeholder="RC 911 / Campus / Venue…"
                options={VERTICAL_OPTIONS}
                onSave={saveField}
              />
              <InlineField
                label="Est. Value"
                field="estimatedValue"
                type="number"
                value={lead.estimatedValue != null ? String(lead.estimatedValue) : ""}
                placeholder="$ Annual contract"
                onSave={saveField}
              />
              <InlineField
                label="Probability"
                field="probability"
                type="number"
                value={lead.probability != null ? String(lead.probability) : ""}
                placeholder="0%"
                onSave={saveField}
              />
              <InlineField
                label="Package"
                field="packageSold"
                type="select"
                value={(lead.packageSold as SalesLeadPackageSold | undefined) ?? "none"}
                placeholder="None"
                options={PACKAGE_OPTIONS}
                onSave={saveField}
              />
              <InlineField
                label="Assigned To"
                field="assignedToName"
                value={lead.assignedToName ?? lead.assignedTo ?? lead.assignee ?? ""}
                placeholder="Unassigned"
                onSave={saveField}
              />
              {lead.pipelineStage === "LOST" && (
                <InlineField
                  label="Lost Reason"
                  field="lostReason"
                  type="select"
                  value={lead.lostReason ?? ""}
                  placeholder="Select reason"
                  options={LOST_REASONS.map((r) => ({ value: r, label: r }))}
                  onSave={saveField}
                />
              )}
            </section>

            <section>
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Next Action
              </h3>
              <InlineField
                label="Action"
                field="nextAction"
                value={lead.nextAction ?? ""}
                placeholder="What needs to happen next?"
                onSave={saveField}
              />
              <InlineField
                label="Due Date"
                field="nextActionDate"
                type="date"
                value={lead.nextActionDate?.slice(0, 10) ?? ""}
                placeholder="Set a follow-up date"
                onSave={saveField}
              />
              <div className="mb-1.5 flex items-start">
                <span className="w-[100px] shrink-0 pt-0.5 text-[11px] text-slate-500">
                  Last Contact
                </span>
                <span className="text-xs text-slate-600">
                  {lead.lastContactedAt
                    ? formatDateTime(lead.lastContactedAt)
                    : "Never contacted"}
                </span>
              </div>
            </section>
          </>
        )}

        {tab === "activity" && (
          <>
            <div className="mb-3">
              <div className="mb-2 flex gap-0.5">
                {(
                  [
                    ["note", "📝 Note"],
                    ["call", "📞 Call"],
                    ["email", "✉️ Email"],
                    ["task", "✅ Task"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setComposer(id)}
                    className={[
                      "rounded border px-2.5 py-1 text-[10px] font-semibold",
                      composer === id
                        ? "border-sky-500 bg-sky-500/15 text-sky-300"
                        : "border-slate-800 text-slate-500",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {composer === "call" && (
                <div className="mb-2 grid grid-cols-3 gap-1.5">
                  <select
                    value={callDirection}
                    onChange={(e) => setCallDirection(e.target.value)}
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                  <input
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                    placeholder="Mins"
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  />
                  <input
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    placeholder="Outcome"
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  />
                </div>
              )}
              {composer === "email" && (
                <div className="mb-2 grid gap-1.5">
                  <input
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="To"
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  />
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject"
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  />
                </div>
              )}
              {composer === "task" && (
                <div className="mb-2 grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  />
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              )}

              <textarea
                ref={noteRef}
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  composer === "note"
                    ? "Add a note about this lead…"
                    : composer === "call"
                      ? "Call notes…"
                      : composer === "email"
                        ? "Email summary…"
                        : "Task description…"
                }
                className="w-full resize-none rounded border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">{text.length} / 2000</span>
                <div className="flex items-center gap-1.5">
                  {composer === "note" && (
                    <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={pinned}
                        onChange={(e) => setPinned(e.target.checked)}
                      />
                      📌 Pin
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={busy || !text.trim()}
                    onClick={() => void submitComposer()}
                    className="rounded bg-sky-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {busy
                      ? "Saving…"
                      : composer === "note"
                        ? "Add Note"
                        : composer === "call"
                          ? "Log Call"
                          : composer === "email"
                            ? "Log Email"
                            : "Add Task"}
                  </button>
                </div>
              </div>
              {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
            </div>

            <h3 className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Timeline
            </h3>
            {items.length === 0 ? (
              <p className="text-[11px] text-slate-600">
                No activity yet. Add a note or move this lead through the pipeline.
              </p>
            ) : (
              <div className="flex flex-col">
                {items.map((item) => {
                  if (item.kind === "note") {
                    const n = item.note;
                    return (
                      <div key={n.noteId} className="relative mb-3.5 flex gap-2.5">
                        <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px]">
                          📝
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-200">Note added</div>
                          <div className="mt-1 rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] leading-relaxed text-slate-400">
                            {n.text}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-600">
                            {n.pinned ? "📌 Pinned · " : ""}
                            {n.authorName} · {formatDateTime(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const a = item.activity;
                  const ic = activityIcon(a.type);
                  return (
                    <div key={a.activityId} className="relative mb-3.5 flex gap-2.5">
                      <div
                        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] ${ic.className}`}
                      >
                        {ic.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-200">{a.description}</div>
                        {a.metadata && Object.keys(a.metadata).length > 0 && (
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {Object.entries(a.metadata)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </div>
                        )}
                        <div className="mt-1 text-[9px] text-slate-600">
                          {[a.authorName, formatDateTime(a.createdAt)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "source" && (
          <>
            <section className="mb-4">
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Lead Source
              </h3>
              <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded text-xs"
                    style={{ backgroundColor: `${channelCfg.color}26` }}
                  >
                    {channelCfg.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{channelCfg.label}</div>
                    <div className="text-[10px] text-slate-500">{channelCfg.description}</div>
                  </div>
                </div>
                <div className="my-2 h-px bg-slate-800" />
                {(
                  [
                    ["Landing Page", lead.attribution?.landingPage],
                    ["Referrer", lead.attribution?.referrerDomain ?? lead.attribution?.referrerUrl],
                    ["Channel", lead.attribution?.channelLabel ?? channelCfg.label],
                    [
                      "Device",
                      lead.attribution?.deviceType
                        ? lead.attribution.deviceType.charAt(0).toUpperCase() +
                          lead.attribution.deviceType.slice(1)
                        : null,
                    ],
                    ["State (IP)", lead.attribution?.ipRegion ?? state],
                    [
                      "First Touch",
                      formatDateTime(lead.attribution?.firstTouchAt ?? lead.createdAt),
                    ],
                  ] as const
                ).map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between py-0.5">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className={`text-[10px] font-medium ${val ? "text-slate-200" : "text-slate-600"}`}>
                      {val || "Not set"}
                    </span>
                  </div>
                ))}
                <div className="my-2 h-px bg-slate-800" />
                {(
                  [
                    ["UTM Source", lead.attribution?.utmSource],
                    ["UTM Medium", lead.attribution?.utmMedium],
                    ["UTM Campaign", lead.attribution?.utmCampaign],
                  ] as const
                ).map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between py-0.5">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className={`text-[10px] font-medium ${val ? "text-slate-200" : "text-slate-600"}`}>
                      {val || "Not set"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                All Source Types
              </h3>
              <div className="flex flex-col gap-1.5">
                {(["ring_waitlist", "contact_sales", "inside_the_cortex"] as const).map((ch) => {
                  const cfg = CHANNEL_CONFIG[ch];
                  const count = attributionSummary?.byChannel[ch]?.count ?? 0;
                  return (
                    <div
                      key={ch}
                      className={`rounded-md border border-slate-800 bg-slate-950 px-3 py-2 ${count === 0 ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cfg.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-slate-200">{cfg.label}</div>
                          <div className="text-[10px] text-slate-500">{cfg.description}</div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-300">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
