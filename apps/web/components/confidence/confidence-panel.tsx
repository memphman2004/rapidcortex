"use client";

import { useState } from "react";
import type {
  ConfidenceAnalysis,
  ConfidenceLevel,
  FieldConfidence,
} from "rapid-cortex-shared";

const LEVEL_COLOR: Record<ConfidenceLevel, string> = {
  HIGH: "text-emerald-400",
  MEDIUM: "text-amber-400",
  LOW: "text-red-400",
  CONFLICT: "text-violet-400",
  MISSING: "text-slate-500",
};

const LEVEL_BAR: Record<ConfidenceLevel, string> = {
  HIGH: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-red-500",
  CONFLICT: "bg-violet-500",
  MISSING: "bg-slate-600",
};

const LEVEL_LEFT: Record<ConfidenceLevel, string> = {
  HIGH: "border-l-emerald-500",
  MEDIUM: "border-l-amber-500",
  LOW: "border-l-red-500",
  CONFLICT: "border-l-violet-500",
  MISSING: "border-l-slate-600",
};

const TREND_ICON = { IMPROVING: "↑", STABLE: "→", DEGRADING: "↓" } as const;
const TREND_COLOR = {
  IMPROVING: "text-emerald-400",
  STABLE: "text-slate-500",
  DEGRADING: "text-red-400",
} as const;

const STATUS_COLOR: Record<string, string> = {
  COMPLETE: "text-emerald-400",
  PARTIAL: "text-amber-400",
  INCOMPLETE: "text-red-400",
  CONFLICTED: "text-violet-400",
};

const STATUS_BG: Record<string, string> = {
  COMPLETE: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  PARTIAL: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  INCOMPLETE: "bg-red-500/10 border-red-500/30 text-red-300",
  CONFLICTED: "bg-violet-500/10 border-violet-500/30 text-violet-300",
};

const WEIGHT_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

function ScoreBar({ score, level }: { score: number; level: ConfidenceLevel }) {
  return (
    <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${LEVEL_BAR[level]}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function FieldRow({
  field,
  expanded,
  onToggle,
}: {
  field: FieldConfidence;
  expanded: boolean;
  onToggle: () => void;
}) {
  const level = field.level;

  return (
    <div
      className={`mb-1.5 cursor-pointer rounded-md border border-slate-800 border-l-[3px] transition-colors ${
        expanded ? "bg-slate-800/60" : "bg-transparent hover:bg-slate-800/30"
      } ${LEVEL_LEFT[level]}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-2.5 py-1.5">
        <div>
          <span className="text-[11px] font-semibold text-slate-200">{field.label}</span>
          {field.weight === "CRITICAL" ? (
            <span className="ml-1.5 text-[8px] font-bold tracking-wide text-red-400">CRITICAL</span>
          ) : null}
        </div>
        <span
          className={`max-w-[120px] truncate text-[10px] ${field.value ? "text-slate-400" : "italic text-slate-600"}`}
          title={field.value ?? undefined}
        >
          {field.value ?? "Not captured"}
        </span>
        <span className={`text-[11px] font-bold tabular-nums ${TREND_COLOR[field.trend]}`}>
          {TREND_ICON[field.trend]}
          {field.trendDelta !== 0 ? (
            <span className="text-[9px]">
              {field.trendDelta > 0 ? "+" : ""}
              {field.trendDelta}
            </span>
          ) : null}
        </span>
        <span className={`min-w-[32px] text-right text-[11px] font-extrabold tabular-nums ${LEVEL_COLOR[level]}`}>
          {level === "MISSING" ? "—" : `${field.score}%`}
        </span>
      </div>

      {level !== "MISSING" ? (
        <div className="px-2.5 pb-1.5">
          <ScoreBar score={field.score} level={level} />
        </div>
      ) : null}

      {expanded ? (
        <div className="border-t border-slate-700/50 px-2.5 pb-2.5 pt-1">
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{field.reason}</p>

          {field.groundingDowngraded ? (
            <div className="mt-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
              AI extraction removed — not grounded in transcript.
            </div>
          ) : null}

          {field.sourceQuote ? (
            <div className="mt-2 text-[10px] text-slate-500">
              <span className="font-semibold uppercase tracking-wide text-slate-600">Source: </span>
              &ldquo;{field.sourceQuote}&rdquo;
            </div>
          ) : null}

          {field.conflictingValues && field.conflictingValues.length > 1 ? (
            <div className="mt-2 rounded border border-violet-500/25 bg-violet-500/10 px-2 py-1.5">
              <div className="mb-1 text-[9px] font-bold tracking-wider text-violet-400">
                CONFLICTING VALUES
              </div>
              {field.conflictingValues.map((v, i) => (
                <div key={i} className="text-[11px] text-slate-200">
                  • {v}
                </div>
              ))}
            </div>
          ) : null}

          {field.suggestedQuestion ? (
            <div className="mt-2 flex gap-2 rounded border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5">
              <span className="shrink-0 text-xs">💬</span>
              <div>
                <div className="mb-0.5 text-[8px] font-bold tracking-wider text-sky-400">
                  SUGGESTED QUESTION
                </div>
                <p className="text-xs leading-snug text-slate-200">&ldquo;{field.suggestedQuestion}&rdquo;</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ConfidencePanel({
  analysis,
  isAnalyzing,
  compact = false,
}: {
  analysis: ConfidenceAnalysis | null;
  isAnalyzing: boolean;
  compact?: boolean;
}) {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!analysis && !isAnalyzing) return null;

  const { aggregate, fields } = analysis ?? { aggregate: null, fields: [] as FieldConfidence[] };

  const sorted = [...fields].sort((a, b) => {
    const aAttn = aggregate?.attentionRequired.includes(a.field) ? 0 : 1;
    const bAttn = aggregate?.attentionRequired.includes(b.field) ? 0 : 1;
    if (aAttn !== bAttn) return aAttn - bAttn;
    if (WEIGHT_ORDER[a.weight] !== WEIGHT_ORDER[b.weight]) {
      return WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight];
    }
    return a.score - b.score;
  });

  const displayed =
    compact && !showAll
      ? sorted.filter(
          (f) =>
            aggregate?.attentionRequired.includes(f.field) ||
            f.weight === "CRITICAL" ||
            f.level === "CONFLICT",
        )
      : sorted;

  const statusColor = aggregate ? STATUS_COLOR[aggregate.pictureStatus] : "text-slate-500";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
        <span className="text-[9px] font-bold tracking-[0.2em] text-slate-500">
          INCIDENT PICTURE CONFIDENCE
        </span>
        {aggregate ? (
          <div className="flex items-center gap-2.5">
            <span className={`text-sm font-extrabold tabular-nums ${statusColor}`}>
              {aggregate.overallScore}%
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${STATUS_BG[aggregate.pictureStatus]}`}
            >
              {aggregate.pictureStatus}
            </span>
          </div>
        ) : null}
        {isAnalyzing && !aggregate ? (
          <span className="animate-pulse text-[10px] text-sky-400">Analyzing…</span>
        ) : null}
      </div>

      {aggregate?.topSuggestedQuestion ? (
        <div className="mx-3 mt-2.5 flex gap-2 rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2">
          <span className="shrink-0 text-sm">💬</span>
          <div>
            <div className="mb-0.5 text-[8px] font-bold tracking-wider text-sky-400">
              HIGHEST PRIORITY QUESTION
            </div>
            <p className="text-[13px] font-medium leading-snug text-slate-100">
              &ldquo;{aggregate.topSuggestedQuestion}&rdquo;
            </p>
          </div>
        </div>
      ) : null}

      {aggregate?.hasConflicts ? (
        <div className="mx-3 mt-2 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-violet-300">
          Conflicting information detected — caller gave multiple different answers on one or more fields.
        </div>
      ) : null}

      {fields.length > 0 ? (
        <div className="px-3 py-2.5">
          {displayed.map((f) => (
            <FieldRow
              key={f.field}
              field={f}
              expanded={expandedField === f.field}
              onToggle={() => setExpandedField((prev) => (prev === f.field ? null : f.field))}
            />
          ))}

          {compact && sorted.length > displayed.length ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 w-full rounded border border-slate-800 py-1.5 text-[10px] text-slate-500 hover:border-slate-700 hover:text-slate-400"
            >
              {showAll ? "Show priority fields only" : `Show all ${sorted.length} fields`}
            </button>
          ) : null}
        </div>
      ) : null}

      {aggregate && aggregate.audioQualityFactor < 0.85 ? (
        <p className="px-3.5 pb-2.5 text-[10px] text-slate-500">
          Audio quality {Math.round(aggregate.audioQualityFactor * 100)}% — confidence scores discounted
          accordingly.
        </p>
      ) : null}
    </div>
  );
}
