"use client";

import type { RapidIqOpportunity, RapidIqVertical } from "@/lib/rapid-iq/types";
import type { RapidIqPipelineSignal } from "rapid-cortex-shared";
import { ActNowSection } from "./act-now-section";
import { IncomingSignalCard } from "./incoming-signal-card";
import { OpportunityCard } from "./opportunity-card";

type Props = {
  opportunities: RapidIqOpportunity[];
  incomingSignals?: RapidIqPipelineSignal[];
  selectedId: string | null;
  selectedSignalId?: string | null;
  onSelect: (id: string) => void;
  onSelectSignal?: (signalId: string) => void;
  vertical: RapidIqVertical | "competitor";
  demo?: boolean;
  pipelineOpportunityIds?: Set<string>;
  addingPipelineId?: string | null;
  dismissingId?: string | null;
  onAddToPipeline?: (opportunity: RapidIqOpportunity) => void;
  onDismissOpportunity?: (opportunity: RapidIqOpportunity) => void;
  onAddSignalToPipeline?: (signal: RapidIqPipelineSignal) => void;
  onDismissSignal?: (signal: RapidIqPipelineSignal) => void;
  pipelineEnabled?: boolean;
};

export function OpportunityFeed({
  opportunities,
  incomingSignals = [],
  selectedId,
  selectedSignalId,
  onSelect,
  onSelectSignal,
  vertical,
  demo,
  pipelineOpportunityIds,
  addingPipelineId,
  dismissingId,
  onAddToPipeline,
  onDismissOpportunity,
  onAddSignalToPipeline,
  onDismissSignal,
  pipelineEnabled = true,
}: Props) {
  const actNow = opportunities.filter((o) => o.isActNow);
  const rest = opportunities.filter((o) => !o.isActNow);
  const total = opportunities.length + incomingSignals.length;

  const card = (opp: RapidIqOpportunity) => (
    <OpportunityCard
      key={opp.opportunityId}
      opportunity={opp}
      selected={selectedId === opp.opportunityId}
      onSelect={() => onSelect(opp.opportunityId)}
      vertical={vertical}
      demo={demo}
      inPipeline={pipelineOpportunityIds?.has(opp.opportunityId) ?? false}
      pipelineBusy={addingPipelineId === opp.opportunityId}
      dismissBusy={dismissingId === opp.opportunityId}
      onAddToPipeline={pipelineEnabled ? () => onAddToPipeline?.(opp) : undefined}
      onDismiss={() => onDismissOpportunity?.(opp)}
    />
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-semibold text-slate-300">Inbox</span>
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
          REVIEW
        </span>
        <span className="ml-auto text-[10px] text-slate-600">
          {total} to dismiss or send to Pipeline
        </span>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]">
        {incomingSignals.map((signal) => (
          <IncomingSignalCard
            key={signal.signalId}
            signal={signal}
            selected={selectedSignalId === signal.signalId}
            busy={addingPipelineId === signal.signalId || dismissingId === signal.signalId}
            vertical={vertical}
            demo={demo}
            onSelect={() => onSelectSignal?.(signal.signalId)}
            onAddToPipeline={() => onAddSignalToPipeline?.(signal)}
            onDismiss={() => onDismissSignal?.(signal)}
          />
        ))}
        {actNow.length > 0 && (
          <ActNowSection count={actNow.length}>
            {actNow.map((opp) => card(opp))}
          </ActNowSection>
        )}
        {rest.map((opp) => card(opp))}
        {total === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No incoming items in this category.</p>
            <p className="max-w-[280px] text-[11px] text-slate-600">
              New opportunities land here first. Dismiss noise or send keepers to Pipeline, then
              push Pipeline to Leads CRM.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
