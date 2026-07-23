"use client";

import { ACTIVE_PIPELINE_STAGES, type PipelineStage, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import { PipelineColumn } from "./pipeline-column";

type Props = {
  stages: Record<PipelineStage, SalesLeadCrmRecord[]>;
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  onDragStart: (leadId: string, stage: PipelineStage) => void;
  onDropLead: (leadId: string, toStage: PipelineStage) => void;
};

export function PipelineBoard({
  stages,
  selectedLeadId,
  onSelect,
  onDragStart,
  onDropLead,
}: Props) {
  return (
    <div
      className="flex gap-3 overflow-x-auto px-5 py-4 pb-8
        [&::-webkit-scrollbar]:h-1
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]"
    >
      {ACTIVE_PIPELINE_STAGES.map((stage) => (
        <PipelineColumn
          key={stage}
          stage={stage}
          leads={stages[stage] ?? []}
          selectedLeadId={selectedLeadId}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDropLead={onDropLead}
        />
      ))}
    </div>
  );
}
