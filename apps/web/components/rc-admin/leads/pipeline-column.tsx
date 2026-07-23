"use client";

import { useState } from "react";
import { STAGE_CONFIG, type PipelineStage, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import { LeadCard } from "./lead-card";
import { formatCurrency } from "./leads-utils";

type Props = {
  stage: PipelineStage;
  leads: SalesLeadCrmRecord[];
  selectedLeadId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string, stage: PipelineStage) => void;
  onDropLead: (id: string, toStage: PipelineStage) => void;
};

export function PipelineColumn({
  stage,
  leads,
  selectedLeadId,
  onSelect,
  onDragStart,
  onDropLead,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const cfg = STAGE_CONFIG[stage];
  const totalValue = leads.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const topBarBg = cfg.borderClass.replace("border-l-", "bg-");

  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0a1628]">
        <div className={`h-[3px] w-full ${topBarBg}`} />
        <div className="flex items-start justify-between px-3 py-2.5">
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-widest ${cfg.textClass}`}>
              {cfg.label}
            </div>
            {totalValue > 0 && (
              <div className="mt-0.5 text-[10px] text-[#334155]">
                {formatCurrency(totalValue)} total
              </div>
            )}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bgClass} ${cfg.textClass}`}
          >
            {leads.length}
          </span>
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
          const id = e.dataTransfer.getData("text/leadId");
          if (id) onDropLead(id, stage);
        }}
        className={[
          "flex min-h-[100px] flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-all duration-150",
          dragOver
            ? "border-sky-500/60 bg-sky-500/[0.04] shadow-inner"
            : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)]",
        ].join(" ")}
      >
        {leads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl opacity-[0.06]">↓</span>
            <span className="text-[11px] text-[#1e3a5f]">
              {dragOver ? "Release to move" : "No leads"}
            </span>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.leadId}
              lead={lead}
              selected={selectedLeadId === lead.leadId}
              onSelect={onSelect}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}
