"use client";

import { type PipelineStage, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import {
  channelBadgeClass,
  channelShortLabel,
  formatCurrency,
  formatShortDate,
  leadAgency,
  leadDisplayName,
  resolveLeadChannel,
} from "./leads-utils";

const STAGE_BORDER: Record<PipelineStage, string> = {
  NEW: "border-l-blue-400",
  CONTACTED: "border-l-cyan-400",
  QUALIFIED: "border-l-emerald-400",
  DISCOVERY: "border-l-yellow-400",
  PROPOSAL: "border-l-purple-400",
  NEGOTIATION: "border-l-pink-400",
  PILOT: "border-l-green-400",
  WON: "border-l-green-500",
  LOST: "border-l-red-500",
};

type Props = {
  lead: SalesLeadCrmRecord;
  selected: boolean;
  onSelect: (leadId: string) => void;
  onDragStart: (leadId: string, stage: PipelineStage) => void;
};

export function LeadCard({ lead, selected, onSelect, onDragStart }: Props) {
  const channel = resolveLeadChannel(lead);
  const agency = leadAgency(lead);
  const stage = lead.pipelineStage;

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/leadId", lead.leadId);
        e.dataTransfer.setData("text/fromStage", stage);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(lead.leadId, stage);
      }}
      onClick={() => onSelect(lead.leadId)}
      className={[
        "w-full rounded-md border border-slate-800 bg-slate-900/80 p-2.5 text-left transition",
        "border-l-[3px] hover:border-slate-700 hover:bg-slate-900",
        STAGE_BORDER[stage],
        selected ? "border-sky-500 bg-slate-900 ring-1 ring-sky-500/40" : "",
      ].join(" ")}
    >
      <div className="truncate text-xs font-semibold text-slate-100">{leadDisplayName(lead)}</div>
      <div className={`mt-0.5 truncate text-[11px] ${agency ? "text-slate-500" : "text-slate-700"}`}>
        {agency || "No agency set"}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${channelBadgeClass(channel)}`}
        >
          {channelShortLabel(channel)}
        </span>
        <span className="text-[10px] text-slate-500">{formatCurrency(lead.estimatedValue)}</span>
      </div>
      <div className="mt-1 text-[9px] text-slate-600">{formatShortDate(lead.createdAt)}</div>
      <div className="mt-1 truncate text-[10px] text-amber-400/90">
        {lead.nextAction?.trim() ? `📅 ${lead.nextAction}` : "📅 No next action"}
      </div>
    </button>
  );
}
