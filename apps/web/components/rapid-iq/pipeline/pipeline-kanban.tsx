"use client";

import {
  RAPID_IQ_KANBAN_COLUMNS,
  displayPipelineScores,
  highestProcurementStage,
  kanbanColumnForStage,
  resolveProcurementStage,
  type RapidIqKanbanColumnId,
  type RapidIqPipelineSignal,
  type RapidIqProcurementStage,
} from "rapid-cortex-shared";
import { DualScoreBadge } from "../dual-score-badge";

const COLUMN_STAGE: Record<RapidIqKanbanColumnId, RapidIqProcurementStage> = {
  monitoring: "monitoring",
  "early-awareness": "early-awareness",
  "budget-funded": "budget-funded",
  "rfi-planning": "rfi-planning",
  rfp: "rfp",
  "competitor-win": "competitor-win",
};

type AgencyCard = {
  key: string;
  column: RapidIqKanbanColumnId;
  signal: RapidIqPipelineSignal;
  count: number;
};

function groupByAgency(signals: RapidIqPipelineSignal[]): AgencyCard[] {
  const map = new Map<string, RapidIqPipelineSignal[]>();
  for (const s of signals) {
    const key = s.agencyProfileId || `${s.agencyName ?? s.rawTitle}|${s.state ?? ""}`;
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return [...map.entries()].map(([key, items]) => {
    const sorted = [...items].sort(
      (a, b) => displayPipelineScores(b).combined - displayPipelineScores(a).combined,
    );
    const top = sorted[0]!;
    const stage = highestProcurementStage(items.map((i) => resolveProcurementStage(i)));
    return { key, column: kanbanColumnForStage(stage), signal: top, count: items.length };
  });
}

type Props = {
  signals: RapidIqPipelineSignal[];
  busy?: boolean;
  onMoveStage: (signalId: string, stage: RapidIqProcurementStage) => void;
  onOpen: (signal: RapidIqPipelineSignal) => void;
};

export function PipelineKanban({ signals, busy, onMoveStage, onOpen }: Props) {
  const cards = groupByAgency(signals);

  return (
    <div className="flex min-h-[360px] gap-3 overflow-x-auto pb-2">
      {RAPID_IQ_KANBAN_COLUMNS.map((col) => {
        const items = cards.filter((c) => c.column === col.id);
        return (
          <div
            key={col.id}
            className="w-56 shrink-0 rounded-lg border border-slate-800 bg-slate-950/60"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const signalId = e.dataTransfer.getData("text/signal-id");
              if (signalId) onMoveStage(signalId, COLUMN_STAGE[col.id]);
            }}
          >
            <div
              className="flex items-center justify-between border-b border-slate-800 px-3 py-2"
              style={{ borderTop: `3px solid ${col.color}` }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-300">{col.label}</span>
              <span className="text-[10px] text-slate-500">{items.length}</span>
            </div>
            <div className="space-y-2 p-2">
              {items.map((card) => {
                const scores = displayPipelineScores(card.signal);
                return (
                  <button
                    key={card.key}
                    type="button"
                    draggable={!busy}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/signal-id", card.signal.signalId);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onOpen(card.signal)}
                    className="w-full rounded-md border border-slate-800 bg-slate-900 p-2 text-left hover:border-slate-600"
                  >
                    <div className="flex items-start gap-2">
                      <DualScoreBadge intent={scores.intent} fit={scores.fit} />
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-slate-100">
                          {card.signal.agencyName || card.signal.rawTitle}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">
                          {card.signal.state ?? ""}
                          {card.count > 1 ? ` · ${card.count} signals` : ""}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[10px] text-slate-400">{card.signal.rawTitle}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
