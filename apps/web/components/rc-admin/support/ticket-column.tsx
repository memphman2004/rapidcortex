"use client";

import { useState } from "react";
import { TICKET_STATUS_CONFIG, type SupportTicketRecord, type TicketStatus } from "rapid-cortex-shared";
import { TicketCard } from "./ticket-card";

type Props = {
  status: TicketStatus;
  tickets: SupportTicketRecord[];
  selectedTicketId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string, status: TicketStatus) => void;
  onDropTicket: (id: string, toStatus: TicketStatus) => void;
};

export function TicketColumn({
  status,
  tickets,
  selectedTicketId,
  onSelect,
  onDragStart,
  onDropTicket,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const cfg = TICKET_STATUS_CONFIG[status];
  const sev1Count = tickets.filter((t) => t.severity === "SEV1").length;
  const topBarBg = cfg.borderClass.replace("border-l-", "bg-");

  return (
    <div className="flex w-[230px] shrink-0 flex-col">
      <div className="mb-2 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0a1628]">
        <div className={`h-[3px] w-full ${topBarBg}`} />
        <div className="flex items-start justify-between px-3 py-2.5">
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-widest ${cfg.textClass}`}>
              {cfg.label}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {sev1Count > 0 && (
              <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">
                {sev1Count}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bgClass} ${cfg.textClass}`}>
              {tickets.length}
            </span>
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const id = e.dataTransfer.getData("text/ticketId");
          if (id) onDropTicket(id, status);
        }}
        className={[
          "flex min-h-[100px] flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-all duration-150",
          dragOver
            ? "border-sky-500/60 bg-sky-500/[0.04] shadow-inner"
            : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)]",
        ].join(" ")}
      >
        {tickets.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl opacity-[0.06]">↓</span>
            <span className="text-[11px] text-[#1e3a5f]">
              {dragOver ? "Release to move" : "No tickets"}
            </span>
          </div>
        ) : (
          tickets.map((ticket) => (
            <TicketCard
              key={ticket.ticketId}
              ticket={ticket}
              selected={selectedTicketId === ticket.ticketId}
              onSelect={onSelect}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}
