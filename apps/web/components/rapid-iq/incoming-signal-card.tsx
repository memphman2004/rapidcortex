"use client";

import { useState } from "react";
import { Calendar, ChevronDown, Sparkles, Swords } from "lucide-react";
import {
  PROCUREMENT_STAGE_LABELS,
  RAPID_IQ_PIPELINE_SOURCE_LABELS,
  displayPipelineScores,
  resolveProcurementStage,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { fetchTalkingPoints } from "@/lib/rapid-iq/api";
import type { RapidIqVertical } from "@/lib/rapid-iq/types";
import { formatCurrency, formatShortDate } from "@/lib/rapid-iq/scoring";
import { ProcurementStageBadge } from "./procurement-stage-badge";
import { DualScoreBadge } from "./dual-score-badge";
import { SignalEvidenceBlock } from "./signal-evidence";
import { TAG_STYLES, VERTICAL_BORDER } from "./opportunity-card";

type FeedVertical = RapidIqVertical | "competitor";

type Props = {
  signal: RapidIqPipelineSignal;
  selected: boolean;
  busy?: boolean;
  vertical: FeedVertical;
  demo?: boolean;
  onSelect: () => void;
  onAddToPipeline: () => void;
  onDismiss: () => void;
};

const SOURCE_TAG_STYLES: Record<string, string> = {
  "GOV NEWS": "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
  "STATE LEGISLATURE": "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  "USASPENDING.GOV": "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  "SAM.GOV": "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  "COUNTY MINUTES": "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  "STATE CONTRACTS": "bg-teal-500/15 text-teal-300 border border-teal-500/30",
  "911 BOARD": "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  "ARPA DASHBOARD": "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  "COUNTY PROCUREMENT": "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  "GRANTS.GOV": "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  "911.GOV": "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  "APCO / NENA": "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
  "COMPETITOR INTEL": "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  BOARDDOCS: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  CIVICCLERK: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  "CO-OP PURCHASING": "bg-teal-500/15 text-teal-300 border border-teal-500/30",
  "UNIVERSITY PROCUREMENT": "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  "FCC 911": "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  911: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  CAMPUS: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  VENUE: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
};

function isCompetitorSignal(signal: RapidIqPipelineSignal): boolean {
  return signal.sourceId === "competitor-intel" || signal.agencyType === "competitor_watch";
}

function synthesizedTags(signal: RapidIqPipelineSignal, vertical: FeedVertical): string[] {
  const tags: string[] = [];
  const sourceLabel = RAPID_IQ_PIPELINE_SOURCE_LABELS[signal.sourceId] ?? signal.sourceId;
  tags.push(sourceLabel.toUpperCase());
  if (vertical === "911") tags.push("911");
  if (vertical === "campus") tags.push("CAMPUS");
  if (vertical === "venue") tags.push("VENUE");
  if (isCompetitorSignal(signal)) tags.push("COMPETITOR");
  if (signal.vendorNamed) tags.push("DISPLACEMENT");
  return tags;
}

function tagClass(tag: string): string {
  return (
    TAG_STYLES[tag] ??
    SOURCE_TAG_STYLES[tag] ??
    "bg-slate-700/50 text-slate-400 border border-slate-600/40"
  );
}

function localTalkingPoints(signal: RapidIqPipelineSignal): string[] {
  const agency = signal.agencyName || signal.jurisdiction || "this agency";
  const stage = PROCUREMENT_STAGE_LABELS[resolveProcurementStage(signal)].label;
  const points = [
    `Open with the ${RAPID_IQ_PIPELINE_SOURCE_LABELS[signal.sourceId] ?? "source"} signal: ${signal.rawTitle}.`,
    `Ask ${agency} where they are in ${stage.toLowerCase()} and who owns vendor evaluation.`,
  ];
  if (signal.vendorNamed) {
    points.push(
      `Probe the incumbent (${signal.vendorNamed}) and any contract-end or displacement window.`,
    );
  }
  if (signal.fundingSource) {
    points.push(`Tie next steps to ${signal.fundingSource} timing and eligible spend.`);
  }
  if (signal.competitorName) {
    const product = signal.competitorProduct ? ` ${signal.competitorProduct}` : "";
    points.push(`Position Rapid Cortex against ${signal.competitorName}${product}.`);
  }
  return points.slice(0, 4);
}

export function IncomingSignalCard({
  signal,
  selected,
  busy = false,
  vertical,
  demo = false,
  onSelect,
  onAddToPipeline,
  onDismiss,
}: Props) {
  const title = signal.agencyName || signal.rawTitle || "Untitled signal";
  const headline =
    signal.agencyName && signal.rawTitle && signal.rawTitle !== signal.agencyName
      ? signal.rawTitle
      : null;
  const competitor = isCompetitorSignal(signal);
  const borderClass =
    vertical === "competitor" || competitor
      ? "border-l-red-500"
      : VERTICAL_BORDER[vertical] ?? VERTICAL_BORDER["911"];
  const tags = synthesizedTags(signal, vertical);
  const scores = displayPipelineScores(signal);

  const [talkingPointsOpen, setTalkingPointsOpen] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState<string[] | null>(null);
  const [loadingTp, setLoadingTp] = useState(false);

  async function handleTalkingPoints(e: React.MouseEvent) {
    e.stopPropagation();
    if (talkingPoints?.length) {
      setTalkingPointsOpen((v) => !v);
      return;
    }
    setLoadingTp(true);
    try {
      let points: string[] = [];
      if (signal.opportunityId) {
        points = await fetchTalkingPoints(signal.opportunityId, demo);
      }
      if (!points.length) {
        points = localTalkingPoints(signal);
      }
      setTalkingPoints(points);
      setTalkingPointsOpen(true);
    } catch {
      setTalkingPoints(localTalkingPoints(signal));
      setTalkingPointsOpen(true);
    } finally {
      setLoadingTp(false);
    }
  }

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
        <DualScoreBadge intent={scores.intent} fit={scores.fit} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-slate-100">{title}</span>
            {signal.state && <span className="text-sm text-slate-500">, {signal.state}</span>}
            {competitor && (
              <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-red-400">
                <Swords size={9} aria-hidden />
                Competitor Intel
              </span>
            )}
            {signal.vendorNamed && !competitor && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400">
                vs {signal.vendorNamed}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${tagClass(tag)}`}>
                {tag}
              </span>
            ))}
            <ProcurementStageBadge signal={signal} />
            {signal.manualEntry && (
              <span className="rounded-full border border-slate-500/40 bg-slate-700/40 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                MANUAL ENTRY
              </span>
            )}
          </div>
        </div>
      </div>

      {headline && <div className="mt-2 text-xs font-semibold text-slate-200">{headline}</div>}
      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
        {signal.excerpt || signal.summary || signal.rawSnippet || signal.rawTitle}
      </div>
      {signal.taxonomyTags && signal.taxonomyTags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {signal.taxonomyTags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
              {tag.replace(/^(technology|procurement|stage):/, "")}
            </span>
          ))}
        </div>
      )}
      <SignalEvidenceBlock signal={signal} />

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="signal-pipeline-btn"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onAddToPipeline();
          }}
        >
          {busy ? "Adding…" : "+ Pipeline"}
        </button>
        <button
          type="button"
          className="btn-dismiss"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          Dismiss
        </button>
        <span className="flex items-center gap-1 text-[10px] text-slate-600">
          <Calendar size={9} />
          {formatShortDate(signal.signalDate || signal.ingestedAt)}
        </span>
        {signal.dollarAmount != null && signal.dollarAmount > 0 && (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            {formatCurrency(signal.dollarAmount)}
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
