"use client";

import { ACTIVE_TICKET_STATUSES, type SupportTicketRecord, type TicketStatus } from "rapid-cortex-shared";
import { TicketColumn } from "./ticket-column";

type Props = {
  columns: Record<TicketStatus, SupportTicketRecord[]>;
  selectedTicketId: string | null;
  onSelect: (ticketId: string) => void;
  onDragStart: (ticketId: string, status: TicketStatus) => void;
  onDropTicket: (ticketId: string, toStatus: TicketStatus) => void;
};

export function TicketBoard({
  columns,
  selectedTicketId,
  onSelect,
  onDragStart,
  onDropTicket,
}: Props) {
  return (
    <div
      className="flex gap-3 overflow-x-auto px-5 py-4 pb-8
        [&::-webkit-scrollbar]:h-1
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]"
    >
      {ACTIVE_TICKET_STATUSES.map((status) => (
        <TicketColumn
          key={status}
          status={status}
          tickets={columns[status] ?? []}
          selectedTicketId={selectedTicketId}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDropTicket={onDropTicket}
        />
      ))}
    </div>
  );
}
