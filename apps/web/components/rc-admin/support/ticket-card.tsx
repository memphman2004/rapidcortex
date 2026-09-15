"use client";

import { TICKET_STATUS_CONFIG, type SupportTicketRecord, type TicketStatus } from "rapid-cortex-shared";
import {
  channelBadgeClass,
  channelShortLabel,
  formatShortDate,
  getAvatarGradient,
  openAgeHours,
  relTime,
  ticketInitials,
} from "./ticket-utils";

type Props = {
  ticket: SupportTicketRecord;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, status: TicketStatus) => void;
};

export function TicketCard({ ticket, selected, onSelect, onDragStart }: Props) {
  const isSev1 = ticket.severity === "SEV1";
  const ageH = openAgeHours(ticket);

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/ticketId", ticket.ticketId);
        e.dataTransfer.setData("text/fromStatus", ticket.status);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(ticket.ticketId, ticket.status);
      }}
      onClick={() => onSelect(ticket.ticketId)}
      className={[
        "group relative w-full rounded-xl border border-l-[3px] p-3 text-left",
        "cursor-grab active:cursor-grabbing transition-all duration-150",
        TICKET_STATUS_CONFIG[ticket.status].borderClass,
        selected
          ? "border-sky-500/40 bg-[#0f2040] ring-1 ring-sky-500/20 shadow-lg shadow-sky-900/20"
          : "border-[rgba(255,255,255,0.06)] bg-[#0d1b35] hover:border-[rgba(255,255,255,0.10)] hover:bg-[#102040]",
      ].join(" ")}
    >
      {isSev1 && (
        <span className="absolute -left-[5px] top-3 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
      )}

      <div className="mb-2.5 flex items-start gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
          style={{ background: getAvatarGradient(ticket.submittedByEmail) }}
        >
          {ticketInitials(ticket)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[11px] font-semibold text-sky-400">{ticket.ticketId}</div>
          <div className="mt-0.5 truncate text-[13px] font-semibold leading-tight text-slate-100">
            {ticket.subject}
          </div>
        </div>
      </div>

      <div className="mb-2 truncate text-[11px] text-slate-500">{ticket.agencyName || ticket.agencyId}</div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${channelBadgeClass(ticket.channel)}`}>
          {channelShortLabel(ticket.channel)}
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
            isSev1 ? "bg-red-500/15 text-red-400" : "bg-white/[0.04] text-slate-400"
          }`}
        >
          {ticket.severity}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-[#1e3a5f]">Opened {formatShortDate(ticket.createdAt)}</span>
        <span className="text-[9px] text-[#1e3a5f]">{relTime(ticket.createdAt) ?? `${ageH}h`}</span>
      </div>
    </button>
  );
}
