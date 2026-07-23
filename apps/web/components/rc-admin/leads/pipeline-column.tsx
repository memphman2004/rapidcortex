"use client";

import { useState } from "react";
import { STAGE_CONFIG, type PipelineStage, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import { LeadCard } from "./lead-card";

type Props = {
  stage: PipelineStage;
  leads: SalesLeadCrmRecord[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  onDragStart: (leadId: string, stage: PipelineStage) => void;
  onDropLead: (leadId: string, toStage: PipelineStage) => void;
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

  return (
    <div className="w-[210px] shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${cfg.bgClass} ${cfg.textClass}`}
        >
          ● {cfg.label.toUpperCase()}
        </span>
        <span className="text-[10px] text-slate-500">{leads.length}</span>
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
          const leadId = e.dataTransfer.getData("text/leadId");
          if (leadId) onDropLead(leadId, stage);
        }}
        className={[
          "flex min-h-[60px] flex-col gap-2 rounded-md border border-slate-800 bg-white/[0.02] p-1.5 transition",
          dragOver ? "border-sky-500 bg-sky-500/10" : "",
        ].join(" ")}
      >
        {leads.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-slate-600">
            Drop here or move a lead
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
