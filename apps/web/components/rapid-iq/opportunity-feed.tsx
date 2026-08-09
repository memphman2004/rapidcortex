"use client";

import type { RapidIqOpportunity, RapidIqVertical } from "@/lib/rapid-iq/types";
import { ActNowSection } from "./act-now-section";
import { OpportunityCard } from "./opportunity-card";

type Props = {
  opportunities: RapidIqOpportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  vertical: RapidIqVertical;
  demo?: boolean;
};

export function OpportunityFeed({ opportunities, selectedId, onSelect, vertical, demo }: Props) {
  const actNow = opportunities.filter((o) => o.isActNow);
  const rest = opportunities.filter((o) => !o.isActNow);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-semibold text-slate-300">This Week</span>
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
          LATEST
        </span>
        <span className="ml-auto text-[10px] text-slate-600">
          {opportunities.length} signals analyzed
        </span>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]">
        {actNow.length > 0 && (
          <ActNowSection count={actNow.length}>
            {actNow.map((opp) => (
              <OpportunityCard
                key={opp.opportunityId}
                opportunity={opp}
                selected={selectedId === opp.opportunityId}
                onSelect={() => onSelect(opp.opportunityId)}
                vertical={vertical}
                demo={demo}
              />
            ))}
          </ActNowSection>
        )}
        {rest.map((opp) => (
          <OpportunityCard
            key={opp.opportunityId}
            opportunity={opp}
            selected={selectedId === opp.opportunityId}
            onSelect={() => onSelect(opp.opportunityId)}
            vertical={vertical}
            demo={demo}
          />
        ))}
        {opportunities.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-600">No opportunities match filters.</p>
        )}
      </div>
    </div>
  );
}
