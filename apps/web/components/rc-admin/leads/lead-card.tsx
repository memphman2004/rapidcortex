"use client";

import { type PipelineStage, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import {
  channelBadgeClass,
  channelShortLabel,
  formatCurrency,
  formatShortDate,
  getAvatarGradient,
  isDueSoon,
  isOverdue,
  leadAgency,
  leadDisplayName,
  leadInitials,
  relTime,
  resolveLeadChannel,
  staleLevel,
  verticalLabel,
} from "./leads-utils";

const STAGE_BORDER: Record<PipelineStage, string> = {
  NEW: "border-l-sky-400",
  CONTACTED: "border-l-cyan-400",
  QUALIFIED: "border-l-emerald-400",
  DISCOVERY: "border-l-yellow-400",
  PROPOSAL: "border-l-violet-400",
  NEGOTIATION: "border-l-pink-400",
  PILOT: "border-l-green-400",
  WON: "border-l-green-500",
  LOST: "border-l-red-500",
};

type Props = {
  lead: SalesLeadCrmRecord;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, stage: PipelineStage) => void;
};

export function LeadCard({ lead, selected, onSelect, onDragStart }: Props) {
  const ch = resolveLeadChannel(lead);
  const agency = leadAgency(lead);
  const stale = staleLevel(lead);
  const overdue = isOverdue(lead.nextActionDate);
  const soon = !overdue && isDueSoon(lead.nextActionDate);
  const hasValue = (lead.estimatedValue ?? 0) > 0;

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/leadId", lead.leadId);
        e.dataTransfer.setData("text/fromStage", lead.pipelineStage);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(lead.leadId, lead.pipelineStage);
      }}
      onClick={() => onSelect(lead.leadId)}
      className={[
        "group w-full rounded-xl border border-l-[3px] p-3 text-left",
        "cursor-grab active:cursor-grabbing transition-all duration-150",
        STAGE_BORDER[lead.pipelineStage],
        selected
          ? "border-sky-500/40 bg-[#0f2040] ring-1 ring-sky-500/20 shadow-lg shadow-sky-900/20"
          : "border-[rgba(255,255,255,0.06)] bg-[#0d1b35] hover:border-[rgba(255,255,255,0.10)] hover:bg-[#102040]",
      ].join(" ")}
    >
      {stale > 0 && (
        <div
          className={`mb-2.5 h-0.5 w-full rounded-full opacity-50 ${
            stale === 2 ? "bg-red-500" : "bg-amber-400"
          }`}
        />
      )}

      <div className="mb-2.5 flex items-start gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
          style={{ background: getAvatarGradient(lead.email) }}
        >
          {leadInitials(lead)}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-[13px] font-semibold leading-tight ${
              agency ? "text-slate-100" : "text-[#334155] italic"
            }`}
          >
            {agency || "No agency"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500">{leadDisplayName(lead)}</div>
        </div>
        {hasValue && (
          <div className="shrink-0 text-[12px] font-bold tabular-nums text-emerald-400">
            {formatCurrency(lead.estimatedValue)}
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${channelBadgeClass(ch)}`}
        >
          {channelShortLabel(ch)}
        </span>
        {lead.vertical && lead.vertical !== "unknown" && (
          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
            {verticalLabel(lead.vertical)}
          </span>
        )}
        {(lead.probability ?? 0) > 0 && (
          <span className="ml-auto text-[9px] tabular-nums text-slate-600">{lead.probability}%</span>
        )}
      </div>

      <div
        className={`mb-1.5 truncate text-[11px] font-medium ${
          overdue ? "text-red-400" : soon ? "text-amber-400" : "text-[#334155]"
        }`}
      >
        {lead.nextAction?.trim() ? (
          `${overdue ? "⚠ " : soon ? "⏰ " : "📅 "}${lead.nextAction}`
        ) : (
          <span className="italic text-[#1e3a5f]">No next action</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-[#1e3a5f]">Added {formatShortDate(lead.createdAt)}</span>
        {lead.lastContactedAt && (
          <span className="text-[9px] text-[#1e3a5f]">{relTime(lead.lastContactedAt)}</span>
        )}
      </div>
    </button>
  );
}
