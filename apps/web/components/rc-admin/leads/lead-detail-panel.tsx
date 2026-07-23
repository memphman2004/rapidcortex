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
  formatCurrency,
  formatDateTime,
  getAvatarGradient,
  leadAgency,
  leadDisplayName,
  leadInitials,
  resolveLeadChannel,
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
  { value: "unknown", label: "Unknown" },
];

const PACKAGE_OPTIONS = (Object.keys(SALES_LEAD_PACKAGE_SOLD_LABELS) as SalesLeadPackageSold[]).map(
  (value) => ({ value, label: SALES_LEAD_PACKAGE_SOLD_LABELS[value] }),
);

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-[#334155]">
      <span>{title}</span>
      <div className="flex-1 border-b border-[rgba(255,255,255,0.04)]" />
    </div>
  );
}

function StageProgress({ stage }: { stage: PipelineStage }) {
  const idx = ACTIVE_PIPELINE_STAGES.indexOf(stage);
  const activeIdx = idx >= 0 ? idx : ACTIVE_PIPELINE_STAGES.length - 1;
  return (
    <div>
      <div className="flex gap-1">
        {ACTIVE_PIPELINE_STAGES.map((s, i) => {
          const done = i < activeIdx;
          const cur = i === activeIdx;
          const bg =
            stage === "WON"
              ? "bg-emerald-500"
              : stage === "LOST"
                ? "bg-red-500"
                : cur
                  ? "bg-emerald-400"
                  : done
                    ? "bg-sky-500"
                    : "bg-[#1e293b]";
          return (
            <div
              key={s}
              title={STAGE_CONFIG[s].label}
              className={`h-1.5 flex-1 rounded-full ${bg}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className={`text-[9px] font-bold ${STAGE_CONFIG[stage].textClass}`}>
          {STAGE_CONFIG[stage].label.toUpperCase()}
        </span>
        <span className="text-[9px] text-[#1e3a5f]">PILOT</span>
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
      <span className="w-[110px] shrink-0 pt-0.5 text-[11px] text-slate-500">{label}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          type === "select" ? (
            <select
              ref={inputRef as RefObject<HTMLSelectElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              className="w-full rounded-lg border border-sky-500 bg-[#060c19] px-2 py-1 text-xs text-slate-100 outline-none ring-1 ring-sky-500/20"
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
              className="w-full rounded-lg border border-sky-500 bg-[#060c19] px-2 py-1 text-xs text-slate-100 outline-none ring-1 ring-sky-500/20"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="group -mx-2 flex w-full items-center justify-between gap-1 rounded-lg px-2 py-0.5 text-left transition hover:bg-white/[0.03]"
          >
            <span
              className={`truncate text-[12px] ${
                value ? "font-medium text-slate-200" : "italic text-[#334155]"
              }`}
            >
              {value || placeholder}
            </span>
            <span className="invisible text-[9px] text-[#334155] group-hover:visible">✎</span>
          </button>
        )}
        {status === "saving" && <span className="shrink-0 text-[9px] text-slate-600">Saving…</span>}
        {status === "saved" && <span className="shrink-0 text-[9px] text-emerald-400">✓ Saved</span>}
        {status === "error" && (
          <span className="shrink-0 text-[9px] text-red-400">Save failed</span>
        )}
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
      return { icon: "✉", className: "bg-amber-500/15 text-amber-300" };
    case "task_added":
      return { icon: "✓", className: "bg-cyan-500/15 text-cyan-300" };
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
    const already = (lead.activities ?? []).some(
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
  const agency = leadAgency(lead);
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

  const attrRows: Array<[string, string | null | undefined]> = [
    ["Landing Page", lead.attribution?.landingPage],
    ["Referrer", lead.attribution?.referrerDomain ?? lead.attribution?.referrerUrl],
    ["Channel", lead.attribution?.channelLabel ?? channelCfg.label],
    [
      "Device",
      lead.attribution?.deviceType
        ? lead.attribution.deviceType.charAt(0).toUpperCase() + lead.attribution.deviceType.slice(1)
        : null,
    ],
    ["State (IP)", lead.attribution?.ipRegion ?? state],
    ["First Touch", formatDateTime(lead.attribution?.firstTouchAt ?? lead.createdAt)],
    ["UTM Source", lead.attribution?.utmSource],
    ["UTM Medium", lead.attribution?.utmMedium],
    ["UTM Campaign", lead.attribution?.utmCampaign],
  ];

  return (
    <aside className="flex w-[460px] shrink-0 flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#080f1e]">
      <div className="shrink-0 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 pb-5 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#334155]">
            Lead Profile
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#334155] transition hover:bg-white/[0.04] hover:text-slate-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-lg"
            style={{ background: getAvatarGradient(lead.email) }}
          >
            {leadInitials(lead)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold leading-tight text-slate-100">{display}</div>
            {agency ? <div className="mt-0.5 text-[12px] text-slate-400">{agency}</div> : null}
            <div className="mt-1 text-[11px] text-slate-600">
              {[lead.email, state, lead.assignedToName && `Assigned: ${lead.assignedToName}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          {(lead.estimatedValue ?? 0) > 0 && (
            <div className="shrink-0 text-[18px] font-black tabular-nums text-emerald-400">
              {formatCurrency(lead.estimatedValue)}
            </div>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wide ${STAGE_CONFIG[lead.pipelineStage].bgClass} ${STAGE_CONFIG[lead.pipelineStage].textClass}`}
          >
            ● {STAGE_CONFIG[lead.pipelineStage].label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold"
            style={{
              color: channelCfg.color,
              borderColor: `${channelCfg.color}30`,
              background: `${channelCfg.color}10`,
            }}
          >
            {channelCfg.icon} {channelCfg.label}
          </span>
          {lead.vertical && lead.vertical !== "unknown" && (
            <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
              {verticalLabel(lead.vertical)}
            </span>
          )}
        </div>

        <StageProgress stage={lead.pipelineStage} />
      </div>

      <div className="flex shrink-0 gap-1.5 border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
        {(
          [
            { label: "📞 Call", t: "activity" as const, c: "call" as const },
            { label: "✉ Email", t: "activity" as const, c: "email" as const },
            { label: "📋 Task", t: "activity" as const, c: "task" as const },
          ] as const
        ).map(({ label, t, c }) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setTab(t);
              setComposer(c);
            }}
            className="flex-1 rounded-lg border border-[rgba(255,255,255,0.06)] py-2 text-[10px] font-bold text-slate-600 transition hover:border-[rgba(255,255,255,0.12)] hover:bg-white/[0.02] hover:text-slate-300"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenStageModal}
          className="flex-[1.4] rounded-lg border border-sky-500/25 bg-sky-500/[0.06] py-2 text-[10px] font-bold text-sky-400 transition hover:bg-sky-500/10"
        >
          → Move Stage
        </button>
      </div>

      <div className="flex shrink-0 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5">
        {(
          [
            ["details", "Overview"],
            ["activity", `Activity${items.length > 0 ? ` (${items.length})` : ""}`],
            ["source", "Source ★"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "-mb-px border-b-2 px-4 py-3 text-[11px] font-bold tracking-wide transition",
              tab === id
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-slate-600 hover:text-slate-400",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]">
        {tab === "details" && (
          <>
            <section className="mb-5">
              <SectionHeader title="Contact Information" />
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
                <span className="w-[110px] shrink-0 pt-0.5 text-[11px] text-slate-500">Email</span>
                <span className="truncate text-[12px] font-medium text-slate-200">{lead.email}</span>
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
                <span className="w-[110px] shrink-0 pt-0.5 text-[11px] text-slate-500">State</span>
                <span
                  className={`text-[12px] ${state ? "font-medium text-slate-200" : "italic text-[#334155]"}`}
                >
                  {state || "—"}
                </span>
              </div>
            </section>

            <section className="mb-5">
              <SectionHeader title="Deal Intelligence" />
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
              <SectionHeader title="Next Action" />
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
                <span className="w-[110px] shrink-0 pt-0.5 text-[11px] text-slate-500">
                  Last Contact
                </span>
                <span className="text-[12px] text-slate-600">
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
            <div className="mb-5 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d1b35]">
              <div className="flex border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628]">
                {(["note", "call", "email", "task"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setComposer(m)}
                    className={[
                      "flex-1 py-2.5 text-[10px] font-bold capitalize transition",
                      composer === m
                        ? "bg-sky-500/10 text-sky-300"
                        : "text-[#334155] hover:text-slate-400",
                    ].join(" ")}
                  >
                    {m === "note"
                      ? "📝 Note"
                      : m === "call"
                        ? "📞 Call"
                        : m === "email"
                          ? "✉ Email"
                          : "✓ Task"}
                  </button>
                ))}
              </div>

              {composer === "call" && (
                <div className="grid grid-cols-3 gap-1.5 border-b border-[rgba(255,255,255,0.04)] px-3 py-2.5">
                  <select
                    value={callDirection}
                    onChange={(e) => setCallDirection(e.target.value)}
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                  <input
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                    placeholder="Mins"
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
                  />
                  <input
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    placeholder="Outcome"
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
                  />
                </div>
              )}
              {composer === "email" && (
                <div className="grid gap-1.5 border-b border-[rgba(255,255,255,0.04)] px-3 py-2.5">
                  <input
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="To"
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
                  />
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject"
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
                  />
                </div>
              )}
              {composer === "task" && (
                <div className="grid grid-cols-2 gap-1.5 border-b border-[rgba(255,255,255,0.04)] px-3 py-2.5">
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
                  />
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#060c19] px-2 py-1 text-[11px] text-slate-200"
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
                    ? "Add a note…"
                    : composer === "call"
                      ? "Call notes…"
                      : composer === "email"
                        ? "Email summary…"
                        : "Task description…"
                }
                className="w-full resize-none bg-transparent px-4 py-3 text-xs text-slate-200 placeholder-[#334155] outline-none"
              />
              <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-[#334155]">{text.length} / 2000</span>
                  {composer === "note" && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={pinned}
                        onChange={(e) => setPinned(e.target.checked)}
                      />
                      📌 Pin
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void submitComposer()}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-[10px] font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
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
              {error && <p className="px-4 pb-3 text-[11px] text-red-400">{error}</p>}
            </div>

            <SectionHeader title="Timeline" />
            {items.length === 0 ? (
              <p className="text-[11px] text-slate-600">
                No activity yet. Add a note or move this lead through the pipeline.
              </p>
            ) : (
              <div className="relative flex flex-col">
                {items.map((item, index) => {
                  if (item.kind === "note") {
                    const n = item.note;
                    return (
                      <div key={n.noteId} className="relative mb-3.5 flex gap-2.5">
                        {index < items.length - 1 && (
                          <div className="absolute bottom-0 left-[10px] top-6 w-px bg-[rgba(255,255,255,0.04)]" />
                        )}
                        <div className="relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px]">
                          📝
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-200">Note added</div>
                          <div className="mt-1.5 rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#060c19] px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                            {n.text}
                          </div>
                          <div className="mt-1 text-[9px] text-[#1e3a5f]">
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
                      {index < items.length - 1 && (
                        <div className="absolute bottom-0 left-[10px] top-6 w-px bg-[rgba(255,255,255,0.04)]" />
                      )}
                      <div
                        className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] ${ic.className}`}
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
                        <div className="mt-1 text-[9px] text-[#1e3a5f]">
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
            <section className="mb-5">
              <SectionHeader title="Lead Source" />
              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d1b35] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                    style={{ background: `${channelCfg.color}15` }}
                  >
                    {channelCfg.icon}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-slate-100">{channelCfg.label}</div>
                    <div className="text-[10px] text-slate-500">{channelCfg.description}</div>
                  </div>
                </div>
                <div className="my-3 h-px bg-[rgba(255,255,255,0.04)]" />
                {attrRows.map(([label, value]) => (
                  <div key={label} className="mb-2 flex items-center justify-between gap-4">
                    <span className="text-[10px] text-slate-600">{label}</span>
                    <span
                      className={`text-right text-[10px] ${
                        value ? "font-medium text-slate-300" : "italic text-[#1e3a5f]"
                      }`}
                    >
                      {value ?? "Not set"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader title="All Lead Sources" />
              <div className="mt-2 flex flex-col gap-2">
                {(["ring_waitlist", "contact_sales", "inside_the_cortex"] as const).map((ch) => {
                  const cfg = CHANNEL_CONFIG[ch];
                  const count = attributionSummary?.byChannel[ch]?.count ?? 0;
                  return (
                    <div
                      key={ch}
                      className={`flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#0d1b35] px-3 py-2.5 ${
                        count === 0 ? "opacity-40" : ""
                      }`}
                    >
                      <span className="text-base">{cfg.icon}</span>
                      <div className="min-w-0 flex-1 text-[11px] font-semibold text-slate-200">
                        {cfg.label}
                      </div>
                      <span className="text-[13px] font-bold" style={{ color: cfg.color }}>
                        {count}
                      </span>
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
