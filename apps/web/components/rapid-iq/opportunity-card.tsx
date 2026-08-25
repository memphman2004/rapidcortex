"use client";

import { useState } from "react";
import { Calendar, ChevronDown, Sparkles, Swords, Users } from "lucide-react";
import { fetchTalkingPoints } from "@/lib/rapid-iq/api";
import type { RapidIqOpportunity, RapidIqVertical } from "@/lib/rapid-iq/types";
import {
  formatCurrency,
  formatPopulation,
  formatShortDate,
  scoreBadgeClass,
} from "@/lib/rapid-iq/scoring";

const TAG_STYLES: Record<string, string> = {
  OPPORTUNITY: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  "GRANT FUNDING": "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  "RFP LIVE": "bg-red-500/15 text-red-300 border border-red-500/30",
  "CAD INTEGRATION": "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  "PSAP SOFTWARE": "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  COMPETITOR: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  "M&A SIGNAL": "bg-red-500/15 text-red-300 border border-red-500/30",
  DISPLACEMENT: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  NG911: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  "STATE BILL": "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  "FEMA FUNDED": "bg-green-500/15 text-green-300 border border-green-500/30",
  "NTIA GRANT": "bg-teal-500/15 text-teal-300 border border-teal-500/30",
  "E911 PLAN": "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  "STATE MANDATE": "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  "CAMPUS SAFETY": "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  "ROAD RACE": "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  "UPCOMING EVENT": "bg-red-500/15 text-red-300 border border-red-500/30",
  "LARGE EVENT": "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  "OBSTACLE COURSE": "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  "CORPORATE ACCOUNT": "bg-sky-500/15 text-sky-300 border border-sky-500/30",
};

const VERTICAL_BORDER: Record<RapidIqVertical, string> = {
  "911": "border-l-sky-500",
  campus: "border-l-emerald-500",
  venue: "border-l-violet-500",
};

export function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${scoreBadgeClass(score)}`}
    >
      {score}
    </div>
  );
}

type Props = {
  opportunity: RapidIqOpportunity;
  selected: boolean;
  onSelect: () => void;
  vertical: RapidIqVertical | "competitor";
  demo?: boolean;
  inPipeline?: boolean;
  pipelineBusy?: boolean;
  dismissBusy?: boolean;
  onAddToPipeline?: () => void;
  onDismiss?: () => void;
};

export function OpportunityCard({
  opportunity,
  selected,
  onSelect,
  vertical,
  demo = false,
  inPipeline = false,
  pipelineBusy = false,
  dismissBusy = false,
  onAddToPipeline,
  onDismiss,
}: Props) {
  const [talkingPointsOpen, setTalkingPointsOpen] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState<string[] | null>(
    opportunity.talkingPoints?.length ? opportunity.talkingPoints : null,
  );
  const [loadingTp, setLoadingTp] = useState(false);
  const [tpError, setTpError] = useState<string | null>(null);

  async function handleTalkingPoints(e: React.MouseEvent) {
    e.stopPropagation();
    if (talkingPoints?.length) {
      setTalkingPointsOpen((v) => !v);
      return;
    }
    setLoadingTp(true);
    setTpError(null);
    try {
      const points = await fetchTalkingPoints(opportunity.opportunityId, demo);
      if (!points.length) {
        setTpError("No talking points returned — try again");
        setTalkingPointsOpen(false);
        return;
      }
      setTalkingPoints(points);
      setTalkingPointsOpen(true);
    } catch (err) {
      setTpError(err instanceof Error ? err.message : "Failed to generate talking points");
    } finally {
      setLoadingTp(false);
    }
  }

  const borderClass =
    vertical === "competitor"
      ? "border-l-red-500"
      : VERTICAL_BORDER[vertical] ?? VERTICAL_BORDER[opportunity.vertical];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        "cursor-pointer border-b border-slate-900/80 border-l-2 px-4 py-3 transition-colors",
        "hover:bg-slate-900/60",
        borderClass,
        selected ? "bg-sky-950/40" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <ScoreBadge score={opportunity.opportunityScore} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-slate-100">{opportunity.agencyName}</span>
            <span className="text-sm text-slate-500">, {opportunity.state}</span>
            {opportunity.agencyType === "competitor_watch" && (
              <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-red-400">
                <Swords size={9} aria-hidden />
                Competitor Intel
              </span>
            )}
            {opportunity.incumbentVendor && opportunity.agencyType !== "competitor_watch" && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400">
                vs {opportunity.incumbentVendor}
              </span>
            )}
            {opportunity.contractExpirySignal && (
              <span className="text-[9px] text-amber-400">Contract ending soon</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {opportunity.tags.map((tag: string) => (
              <span
                key={tag}
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  TAG_STYLES[tag] ?? "bg-slate-700/50 text-slate-400"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs font-semibold text-slate-200">{opportunity.aiHeadline}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
        {opportunity.aiSummary}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        {onAddToPipeline && (
          <button
            type="button"
            className={`signal-pipeline-btn ${inPipeline ? "in-pipeline" : ""}`}
            disabled={inPipeline || pipelineBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (!inPipeline) onAddToPipeline();
            }}
          >
            {inPipeline ? "✓ In Pipeline" : pipelineBusy ? "Adding…" : "+ Pipeline"}
          </button>
        )}
        {onDismiss && !inPipeline && (
          <button
            type="button"
            className="btn-dismiss"
            disabled={dismissBusy || pipelineBusy}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
          >
            {dismissBusy ? "Dismissing…" : "Dismiss"}
          </button>
        )}
        <span className="flex items-center gap-1 text-[10px] text-slate-600">
          <Calendar size={9} />
          {formatShortDate(opportunity.lastSignalAt)}
        </span>
        {opportunity.population != null && opportunity.population > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-slate-600">
            <Users size={9} />
            {formatPopulation(opportunity.population)}
          </span>
        )}
        {opportunity.estimatedDollarValue != null && opportunity.estimatedDollarValue > 0 && (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            {formatCurrency(opportunity.estimatedDollarValue)}
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <button
          type="button"
          onClick={handleTalkingPoints}
          className="flex items-center gap-1 rounded border border-slate-800 px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
        >
          <Sparkles size={9} />
          {loadingTp ? "Generating…" : "Talking Points"}
          {talkingPoints && talkingPoints.length > 0 && (
            <ChevronDown
              size={9}
              className={talkingPointsOpen ? "rotate-180 transition-transform" : "transition-transform"}
            />
          )}
        </button>
      </div>

      {tpError && (
        <div className="mt-2 text-[10px] text-red-400">{tpError}</div>
      )}

      {talkingPointsOpen && talkingPoints && talkingPoints.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-sky-500/30 pl-3">
          {talkingPoints.map((point, i) => (
            <div key={i} className="flex gap-2 text-[11px] text-slate-400">
              <span className="shrink-0 font-bold text-sky-500">{i + 1}.</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { TAG_STYLES, VERTICAL_BORDER };
