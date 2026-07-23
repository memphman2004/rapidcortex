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
    <div className="flex flex-1 items-start gap-2.5 overflow-x-auto p-3.5">
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
