"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACTIVE_TICKET_STATUSES,
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  SEVERITY_CONFIG,
  SUPPORT_CATEGORIES,
  TICKET_SEVERITIES,
  TICKET_STATUS_CONFIG,
  type PatchSupportTicketBody,
  type SupportCategory,
  type SupportTicketRecord,
  type TicketSeverity,
} from "rapid-cortex-shared";
import { addTicketNote, updateTicket } from "./tickets-api";
import {
  channelBadgeClass,
  channelShortLabel,
  formatDateTime,
  getAvatarGradient,
  ticketInitials,
} from "./ticket-utils";

type Tab = "details" | "activity" | "contact";

type Props = {
  ticket: SupportTicketRecord;
  onClose: () => void;
  onTicketUpdated: (ticket: SupportTicketRecord) => void;
  onOpenStatusModal: () => void;
  focusNoteToken: number;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-[#334155]">
      <span>{title}</span>
      <div className="flex-1 border-b border-[rgba(255,255,255,0.04)]" />
    </div>
  );
}

function StatusProgress({ status }: { status: SupportTicketRecord["status"] }) {
  const idx = ACTIVE_TICKET_STATUSES.indexOf(status as (typeof ACTIVE_TICKET_STATUSES)[number]);
  const activeIdx = idx >= 0 ? idx : ACTIVE_TICKET_STATUSES.length - 1;
  return (
    <div>
      <div className="flex gap-1">
        {ACTIVE_TICKET_STATUSES.map((s, i) => {
          const done = i < activeIdx;
          const cur = i === activeIdx;
          const bg = cur ? "bg-emerald-400" : done ? "bg-sky-500" : "bg-[#1e293b]";
          return <div key={s} title={TICKET_STATUS_CONFIG[s].label} className={`h-1.5 flex-1 rounded-full ${bg}`} />;
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className={`text-[9px] font-bold ${TICKET_STATUS_CONFIG[status].textClass}`}>
          {TICKET_STATUS_CONFIG[status].label.toUpperCase()}
        </span>
        <span className="text-[9px] text-[#1e3a5f]">ESCALATED</span>
      </div>
    </div>
  );
}

function InlineField({
  label,
  value,
  field,
  type = "text",
  options,
  onSave,
}: {
  label: string;
  value: string;
  field: keyof PatchSupportTicketBody;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
  onSave: (field: keyof PatchSupportTicketBody, value: string) => Promise<void>;
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
    if (next === value.trim()) return;
    setStatus("saving");
    try {
      await onSave(field, next);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setDraft(value);
      setStatus("error");
    }
  }

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
        <span className="text-[9px] text-slate-600">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Error" : ""}
        </span>
      </div>
      {editing ? (
        type === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            className="w-full rounded-lg border border-sky-500/40 bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none"
          >
            {(options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit();
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            className="w-full rounded-lg border border-sky-500/40 bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none"
          />
        )
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-lg border border-transparent px-3 py-2 text-left text-xs text-slate-200 hover:border-[rgba(255,255,255,0.08)] hover:bg-[#080f1e]"
        >
          {options?.find((o) => o.value === value)?.label || value || <span className="italic text-slate-600">—</span>}
        </button>
      )}
    </div>
  );
}

export function TicketDetailPanel({
  ticket,
  onClose,
  onTicketUpdated,
  onOpenStatusModal,
  focusNoteToken,
}: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const items = [...(ticket.activities ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useEffect(() => {
    if (focusNoteToken > 0) {
      setTab("activity");
      window.setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [focusNoteToken]);

  async function saveField(field: keyof PatchSupportTicketBody, value: string) {
    const updated = await updateTicket(ticket.ticketId, { [field]: value } as PatchSupportTicketBody);
    onTicketUpdated(updated);
  }

  async function submitNote() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await addTicketNote(ticket.ticketId, text.trim());
      onTicketUpdated(updated);
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-full max-w-[420px] shrink-0 flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0a1628]">
      <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
              style={{ background: getAvatarGradient(ticket.submittedByEmail) }}
            >
              {ticketInitials(ticket)}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[12px] font-bold text-sky-400">{ticket.ticketId}</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-100">{ticket.subject}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {ticket.agencyName} · {ticket.submittedByName}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#334155] transition hover:text-slate-300">
            ✕
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${TICKET_STATUS_CONFIG[ticket.status].bgClass} ${TICKET_STATUS_CONFIG[ticket.status].textClass}`}
          >
            {TICKET_STATUS_CONFIG[ticket.status].label}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${SEVERITY_CONFIG[ticket.severity].bgClass} ${SEVERITY_CONFIG[ticket.severity].textClass}`}
          >
            {ticket.severity}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${channelBadgeClass(ticket.channel)}`}>
            {channelShortLabel(ticket.channel)} · {CHANNEL_LABELS[ticket.channel]}
          </span>
        </div>
        <StatusProgress status={ticket.status} />
      </div>

      <div className="flex shrink-0 gap-1.5 border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
        <button
          type="button"
          onClick={onOpenStatusModal}
          className="flex-1 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] py-2 text-[10px] font-bold text-sky-400 transition hover:bg-sky-500/10"
        >
          → Move Status
        </button>
        <button
          type="button"
          onClick={onOpenStatusModal}
          className="flex-1 rounded-lg border border-emerald-500/20 py-2 text-[10px] font-bold text-emerald-400/80 hover:bg-emerald-500/10"
        >
          Mark Resolved
        </button>
      </div>

      <div className="flex shrink-0 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5">
        {(
          [
            ["details", "Overview"],
            ["activity", `Activity${items.length > 0 ? ` (${items.length})` : ""}`],
            ["contact", "Contact"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "-mb-px border-b-2 px-4 py-3 text-[11px] font-bold tracking-wide transition",
              tab === id ? "border-sky-500 text-sky-300" : "border-transparent text-slate-600 hover:text-slate-400",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]">
        {tab === "details" && (
          <>
            <SectionHeader title="Ticket" />
            <InlineField label="Subject" value={ticket.subject} field="subject" onSave={saveField} />
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Description</div>
              <p className="whitespace-pre-wrap rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#080f1e] px-3 py-2 text-xs leading-relaxed text-slate-300">
                {ticket.description}
              </p>
            </div>
            <InlineField
              label="Category"
              value={ticket.category}
              field="category"
              type="select"
              options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c as SupportCategory] }))}
              onSave={saveField}
            />
            <InlineField
              label="Severity"
              value={ticket.severity}
              field="severity"
              type="select"
              options={TICKET_SEVERITIES.map((s) => ({ value: s, label: SEVERITY_CONFIG[s as TicketSeverity].label }))}
              onSave={saveField}
            />
            <InlineField
              label="Assigned to"
              value={ticket.assignedToName ?? ticket.assignedToUserId ?? ""}
              field="assignedToName"
              onSave={saveField}
            />
            {ticket.channel === "web_form" && ticket.currentPageUrl && (
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Page URL</div>
                <p className="break-all text-[11px] text-sky-500/80">{ticket.currentPageUrl}</p>
              </div>
            )}
            {ticket.userAgent && (
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Browser</div>
                <p className="break-all text-[11px] text-slate-500">{ticket.userAgent}</p>
              </div>
            )}
          </>
        )}

        {tab === "activity" && (
          <>
            <div className="mb-4 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#080f1e]">
              <textarea
                ref={noteRef}
                rows={3}
                maxLength={4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a note…"
                className="w-full resize-none bg-transparent px-4 py-3 text-xs text-slate-200 placeholder-[#334155] outline-none"
              />
              <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
                <span className="text-[9px] text-[#334155]">{text.length} / 4000</span>
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void submitNote()}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-[10px] font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Add Note"}
                </button>
              </div>
              {error && <p className="px-4 pb-3 text-[11px] text-red-400">{error}</p>}
            </div>
            <SectionHeader title="Timeline" />
            {items.length === 0 ? (
              <p className="text-[11px] text-slate-600">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {items.map((a) => (
                  <li key={a.activityId} className="border-l border-[rgba(255,255,255,0.08)] pl-3">
                    <div className="text-[11px] text-slate-300">{a.label}</div>
                    <div className="mt-0.5 text-[9px] text-slate-600">
                      {a.authorName} · {formatDateTime(a.createdAt)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {(ticket.notes ?? []).length > 0 && (
              <div className="mt-6">
                <SectionHeader title="Notes" />
                <ul className="space-y-3">
                  {[...ticket.notes].reverse().map((n) => (
                    <li key={n.noteId} className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#080f1e] px-3 py-2">
                      <p className="whitespace-pre-wrap text-xs text-slate-200">{n.text}</p>
                      <p className="mt-1 text-[9px] text-slate-600">
                        {n.authorName} · {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {tab === "contact" && (
          <>
            <SectionHeader title="Submitter" />
            <p className="text-xs text-slate-200">{ticket.submittedByName}</p>
            <p className="mt-1 text-[11px] text-slate-500">{ticket.submittedByEmail}</p>
            <p className="mt-1 text-[11px] text-slate-500">{ticket.submittedByRole}</p>
            <div className="mt-5">
              <SectionHeader title="Agency" />
              <p className="text-xs text-slate-200">{ticket.agencyName}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{ticket.agencyId}</p>
            </div>
            {ticket.channel === "phone" && (
              <div className="mt-5">
                <SectionHeader title="Call" />
                <p className="text-xs text-slate-300">{ticket.callerPhone ?? "—"}</p>
                {ticket.callDurationSeconds != null && (
                  <p className="mt-1 text-[11px] text-slate-500">{ticket.callDurationSeconds}s</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
