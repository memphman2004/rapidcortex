"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVE_TICKET_STATUSES,
  TICKET_STATUSES,
  TICKET_STATUS_CONFIG,
  type SupportTicketRecord,
  type TicketBoardData,
  type TicketStatus,
} from "rapid-cortex-shared";
import { TicketBoard } from "./ticket-board";
import { TicketDetailPanel } from "./ticket-detail-panel";
import { getTicketBoard, updateTicketStatus } from "./tickets-api";
import {
  formatShortDate,
  matchesChannelFilter,
  matchesSeverityFilter,
  matchesTicketSearch,
  type ChannelFilter,
  type SeverityFilter,
} from "./ticket-utils";

const BOARD_QUERY_KEY = ["rc-admin-support-board"] as const;

type ViewMode = "board" | "list";
type ListSortKey = "id" | "subject" | "agency" | "status" | "severity" | "channel" | "submitter" | "created";

function emptyColumns(): Record<TicketStatus, SupportTicketRecord[]> {
  return Object.fromEntries(TICKET_STATUSES.map((s) => [s, [] as SupportTicketRecord[]])) as Record<
    TicketStatus,
    SupportTicketRecord[]
  >;
}

function filterColumns(
  columns: Record<TicketStatus, SupportTicketRecord[]>,
  search: string,
  channel: ChannelFilter,
  severity: SeverityFilter,
): Record<TicketStatus, SupportTicketRecord[]> {
  const next = emptyColumns();
  for (const status of TICKET_STATUSES) {
    next[status] = (columns[status] ?? []).filter(
      (t) =>
        matchesTicketSearch(t, search) &&
        matchesChannelFilter(t, channel) &&
        matchesSeverityFilter(t, severity),
    );
  }
  return next;
}

function StatusChangeModal({
  ticket,
  targetStatus,
  onClose,
  onConfirm,
  busy,
  error,
}: {
  ticket: SupportTicketRecord;
  targetStatus: TicketStatus | null;
  onClose: () => void;
  onConfirm: (opts: {
    status: TicketStatus;
    note?: string;
    resolutionNotes?: string;
    reopenReason?: string;
  }) => void;
  busy: boolean;
  error: string | null;
}) {
  const [status, setStatus] = useState<TicketStatus>(targetStatus ?? ticket.status);
  const [note, setNote] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    if (targetStatus) setStatus(targetStatus);
  }, [targetStatus]);

  const needsResolution = status === "RESOLVED" || status === "CLOSED";
  const needsReopen = (ticket.status === "RESOLVED" || ticket.status === "CLOSED") && status === "OPEN";
  const blocked =
    (needsResolution && !resolutionNotes.trim() && !note.trim()) || (needsReopen && !reopenReason.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d1b35] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Move Status</h2>
          <button type="button" onClick={onClose} className="text-[#334155] transition hover:text-slate-300">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {TICKET_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                  status === s
                    ? `${TICKET_STATUS_CONFIG[s].bgClass} ${TICKET_STATUS_CONFIG[s].textClass} border-transparent`
                    : "border-[rgba(255,255,255,0.06)] text-slate-500 hover:border-[rgba(255,255,255,0.12)]",
                ].join(" ")}
              >
                {TICKET_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          {needsResolution && (
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Resolution notes <span className="text-red-400">*</span>
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
            </div>
          )}
          {needsReopen && (
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Reopen reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs text-slate-500">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || blocked}
            onClick={() =>
              onConfirm({
                status,
                note: note.trim() || undefined,
                resolutionNotes: needsResolution ? resolutionNotes.trim() || note.trim() : undefined,
                reopenReason: needsReopen ? reopenReason.trim() : undefined,
              })
            }
            className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Moving…" : `Move to ${TICKET_STATUS_CONFIG[status].label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketsListView({
  tickets,
  selectedTicketId,
  onSelect,
}: {
  tickets: SupportTicketRecord[];
  selectedTicketId: string | null;
  onSelect: (ticketId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<ListSortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...tickets];
    copy.sort((a, b) => {
      let av = "";
      let bv = "";
      switch (sortKey) {
        case "id":
          av = a.ticketId;
          bv = b.ticketId;
          break;
        case "subject":
          av = a.subject.toLowerCase();
          bv = b.subject.toLowerCase();
          break;
        case "agency":
          av = (a.agencyName || a.agencyId).toLowerCase();
          bv = (b.agencyName || b.agencyId).toLowerCase();
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "severity":
          av = a.severity;
          bv = b.severity;
          break;
        case "channel":
          av = a.channel;
          bv = b.channel;
          break;
        case "submitter":
          av = a.submittedByName.toLowerCase();
          bv = b.submittedByName.toLowerCase();
          break;
        default:
          av = a.createdAt;
          bv = b.createdAt;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [tickets, sortAsc, sortKey]);

  function toggleSort(key: ListSortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const th = (key: ListSortKey, label: string) => (
    <th className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 first:pl-5 last:pr-5">
      <button type="button" onClick={() => toggleSort(key)} className="hover:text-slate-300">
        {label}
        {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628]">
            {th("id", "Ticket ID")}
            {th("subject", "Subject")}
            {th("agency", "Agency")}
            {th("status", "Status")}
            {th("severity", "Severity")}
            {th("channel", "Channel")}
            {th("submitter", "Submitted By")}
            {th("created", "Created")}
            <th className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">
              Assigned
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ticket) => {
            const selected = selectedTicketId === ticket.ticketId;
            return (
              <tr
                key={ticket.ticketId}
                onClick={() => onSelect(ticket.ticketId)}
                className={[
                  "cursor-pointer border-b border-[rgba(255,255,255,0.03)] transition-colors",
                  selected ? "bg-sky-500/5" : "hover:bg-[rgba(255,255,255,0.02)]",
                ].join(" ")}
              >
                <td className="px-5 py-3 font-mono text-[11px] text-sky-400">{ticket.ticketId}</td>
                <td className="max-w-[220px] truncate px-5 py-3 text-xs text-slate-100">{ticket.subject}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{ticket.agencyName || ticket.agencyId}</td>
                <td className="px-5 py-3 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${TICKET_STATUS_CONFIG[ticket.status].bgClass} ${TICKET_STATUS_CONFIG[ticket.status].textClass}`}
                  >
                    {TICKET_STATUS_CONFIG[ticket.status].label}
                  </span>
                </td>
                <td className={`px-5 py-3 text-xs ${ticket.severity === "SEV1" ? "font-bold text-red-400" : "text-slate-400"}`}>
                  {ticket.severity}
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{ticket.channel}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{ticket.submittedByName}</td>
                <td className="px-5 py-3 text-[11px] text-slate-500">{formatShortDate(ticket.createdAt)}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{ticket.assignedToName ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-600">No tickets match the current filters.</p>
      )}
    </div>
  );
}

export function TicketBoardClient() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [view, setView] = useState<ViewMode>("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ ticketId: string; targetStatus: TicketStatus | null } | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [focusNoteToken, setFocusNoteToken] = useState(0);

  const boardQ = useQuery({
    queryKey: BOARD_QUERY_KEY,
    queryFn: getTicketBoard,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  const columns = boardQ.data?.columns ?? emptyColumns();
  const metrics = boardQ.data?.metrics;
  const filtered = useMemo(
    () => filterColumns(columns, search, channelFilter, severityFilter),
    [columns, search, channelFilter, severityFilter],
  );
  const allFiltered = useMemo(() => TICKET_STATUSES.flatMap((s) => filtered[s] ?? []), [filtered]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      allFiltered.find((t) => t.ticketId === selectedId) ??
      TICKET_STATUSES.flatMap((s) => columns[s] ?? []).find((t) => t.ticketId === selectedId) ??
      null
    );
  }, [allFiltered, selectedId, columns]);

  const patchCacheTicket = useCallback(
    (updated: SupportTicketRecord) => {
      qc.setQueryData<TicketBoardData>(BOARD_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        const nextColumns = emptyColumns();
        for (const status of TICKET_STATUSES) {
          nextColumns[status] = (prev.columns[status] ?? []).filter((t) => t.ticketId !== updated.ticketId);
        }
        nextColumns[updated.status] = [...(nextColumns[updated.status] ?? []), updated];
        return { ...prev, columns: nextColumns };
      });
    },
    [qc],
  );

  const statusMutation = useMutation({
    mutationFn: async (args: {
      ticketId: string;
      status: TicketStatus;
      note?: string;
      resolutionNotes?: string;
      reopenReason?: string;
    }) => updateTicketStatus(args.ticketId, args.status, args),
    onSuccess: (updated) => {
      patchCacheTicket(updated);
      void qc.invalidateQueries({ queryKey: BOARD_QUERY_KEY });
      setStatusModal(null);
      setStatusError(null);
    },
    onError: (err) => setStatusError((err as Error).message),
  });

  function requestStatusMove(ticketId: string, toStatus: TicketStatus) {
    const from = TICKET_STATUSES.flatMap((s) => columns[s] ?? []).find((t) => t.ticketId === ticketId)?.status;
    if (!from || from === toStatus) return;
    setStatusError(null);
    setStatusModal({ ticketId, targetStatus: toStatus });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (statusModal) {
          setStatusModal(null);
          return;
        }
        if (selectedId) {
          setSelectedId(null);
          return;
        }
      }
      if (typing) return;
      if (e.key.toLowerCase() === "n" && selectedId) {
        e.preventDefault();
        setFocusNoteToken((t) => t + 1);
      }
      if (e.key.toLowerCase() === "m" && selectedId) {
        e.preventDefault();
        setStatusModal({ ticketId: selectedId, targetStatus: null });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, statusModal]);

  const modalTicket = statusModal
    ? TICKET_STATUSES.flatMap((s) => columns[s] ?? []).find((t) => t.ticketId === statusModal.ticketId)
    : null;

  const channelChips: { id: ChannelFilter; label: string }[] = [
    { id: "all", label: "All Channels" },
    { id: "web_form", label: "Web Form" },
    { id: "phone", label: "Phone" },
  ];

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#050c1a]">
      <div className="flex flex-wrap items-stretch gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-3">
        <Metric value={String(metrics?.totalOpen ?? 0)} label="Total Open" color="text-sky-400" icon="◎" />
        <Metric
          value={String(metrics?.sev1Active ?? 0)}
          label="SEV1 Active"
          color="text-red-400"
          icon="!"
          pulse={(metrics?.sev1Active ?? 0) > 0}
        />
        <Metric value={String(metrics?.sev2Active ?? 0)} label="SEV2 Active" color="text-orange-400" icon="⚡" />
        <Metric
          value={metrics?.avgResolutionHours == null ? "—" : `${metrics.avgResolutionHours}h`}
          label="Avg Resolution"
          color="text-slate-500"
          icon="◷"
        />
        <Metric
          value={metrics?.oldestOpenHours == null ? "—" : `${metrics.oldestOpenHours}h`}
          label="Open longest"
          color="text-amber-400"
          icon="⌛"
        />
        <Metric
          value={String(metrics?.resolvedThisMonth ?? 0)}
          label="Resolved this month"
          color="text-emerald-400"
          icon="✓"
        />
        <div className="ml-auto flex items-stretch gap-2">
          <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2">
            <span className="text-xl font-extrabold leading-none text-emerald-400">
              {columns.RESOLVED?.length ?? 0}
            </span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">Resolved</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-500/20 bg-slate-500/[0.05] px-4 py-2">
            <span className="text-xl font-extrabold leading-none text-slate-400">{columns.CLOSED?.length ?? 0}</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">Closed</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-2.5">
        <div className="relative min-w-[240px] max-w-[300px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#334155]">
            🔍
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, agencies, IDs…"
            className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-[#334155] outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
          />
        </div>
        {channelChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setChannelFilter(chip.id)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
              channelFilter === chip.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-[rgba(255,255,255,0.06)] text-slate-600 hover:border-[rgba(255,255,255,0.12)] hover:text-slate-400",
            ].join(" ")}
          >
            {chip.label}
          </button>
        ))}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="rounded-full border border-[rgba(255,255,255,0.06)] bg-transparent px-3 py-1.5 text-[11px] text-slate-600 outline-none focus:border-sky-500"
        >
          <option value="all">All Severities</option>
          <option value="SEV1">SEV1</option>
          <option value="SEV2">SEV2</option>
          <option value="SEV3">SEV3</option>
          <option value="SEV4">SEV4</option>
        </select>
        <div className="ml-auto flex rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] p-0.5">
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
                view === v ? "bg-sky-500/15 text-sky-300" : "text-[#334155] hover:text-slate-400",
              ].join(" ")}
            >
              {v === "board" ? "⊞ Board" : "☰ List"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#050c1a]">
        {boardQ.isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2.5 text-sm text-slate-600">
            <span className="animate-spin text-sky-500/60">↻</span>
            Loading tickets…
          </div>
        ) : boardQ.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] px-10 py-8">
              <div className="mb-2 text-4xl opacity-30">⚠</div>
              <div className="mb-1 text-sm font-semibold text-red-400">Board failed to load</div>
              <div className="mb-5 max-w-[260px] text-xs text-slate-600">{(boardQ.error as Error).message}</div>
              <button
                type="button"
                onClick={() => void boardQ.refetch()}
                className="rounded-lg border border-sky-500/30 bg-sky-500/8 px-5 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-500/15"
              >
                ↻ Try again
              </button>
            </div>
          </div>
        ) : allFiltered.length === 0 && !search && channelFilter === "all" && severityFilter === "all" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="text-5xl opacity-[0.05]">🎫</div>
            <div className="text-sm font-semibold text-slate-400">No support tickets yet</div>
            <div className="max-w-[260px] text-xs text-slate-600">
              Web form submissions appear here. Phone-line records stay on the call audit log.
            </div>
          </div>
        ) : view === "board" ? (
          <TicketBoard
            columns={filtered}
            selectedTicketId={selectedId}
            onSelect={setSelectedId}
            onDragStart={() => undefined}
            onDropTicket={requestStatusMove}
          />
        ) : (
          <TicketsListView
            tickets={allFiltered.filter(
              (t) => ACTIVE_TICKET_STATUSES.includes(t.status) || t.status === "RESOLVED" || t.status === "CLOSED",
            )}
            selectedTicketId={selectedId}
            onSelect={setSelectedId}
          />
        )}

        {selected && (
          <TicketDetailPanel
            ticket={selected}
            onClose={() => setSelectedId(null)}
            onTicketUpdated={patchCacheTicket}
            onOpenStatusModal={() => {
              setStatusError(null);
              setStatusModal({ ticketId: selected.ticketId, targetStatus: null });
            }}
            focusNoteToken={focusNoteToken}
          />
        )}
      </div>

      {statusModal && modalTicket && (
        <StatusChangeModal
          ticket={modalTicket}
          targetStatus={statusModal.targetStatus}
          busy={statusMutation.isPending}
          error={statusError}
          onClose={() => {
            setStatusModal(null);
            setStatusError(null);
          }}
          onConfirm={(opts) => {
            statusMutation.mutate({ ticketId: modalTicket.ticketId, ...opts });
          }}
        />
      )}
    </div>
  );
}

function Metric({
  value,
  label,
  color,
  icon,
  pulse,
}: {
  value: string;
  label: string;
  color: string;
  icon: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex min-w-[110px] flex-col gap-1 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d1b35] px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-[12px] opacity-50 ${color} ${pulse ? "animate-pulse" : ""}`}>{icon}</span>
        <span
          className={`text-2xl font-extrabold leading-none tracking-tight tabular-nums ${color} ${pulse ? "animate-pulse" : ""}`}
        >
          {value}
        </span>
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</div>
    </div>
  );
}
