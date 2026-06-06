"use client";

import { useMemo, useState } from "react";
import type { HospitalRecommendation } from "rapid-cortex-shared";

import {
  formatTraumaLevel,
  parseAddressCityState,
  RECOMMENDATION_ICONS,
  recommendationLabel,
} from "./hospital-utils";

type SortKey = "score" | "distance" | "capacity";

export interface HospitalTableProps {
  recommendations: HospitalRecommendation[];
  selectedHospital: string | null;
  onSelectHospital: (hospitalId: string) => void;
  onOpenDetail?: (hospitalId: string) => void;
}

export function HospitalTable({
  recommendations,
  selectedHospital,
  onSelectHospital,
  onOpenDetail,
}: HospitalTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const sorted = useMemo(() => {
    const copy = [...recommendations];
    copy.sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return a.routing.distanceMiles - b.routing.distanceMiles;
        case "capacity":
          return (
            b.capacity.availability.erBeds.available - a.capacity.availability.erBeds.available
          );
        default:
          return b.scoring.overallScore - a.scoring.overallScore;
      }
    });
    return copy;
  }, [recommendations, sortBy]);

  if (recommendations.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        No hospitals with capacity data for this agency.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="border-b border-slate-700 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-white">{recommendations.length} Hospitals</h3>
          <div className="flex gap-2">
            {(
              [
                ["score", "Best match"],
                ["distance", "Closest"],
                ["capacity", "Most capacity"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={`rounded px-3 py-1 text-sm ${
                  sortBy === key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {sorted.map((rec, index) => (
          <HospitalCard
            key={rec.hospitalId}
            recommendation={rec}
            rank={index + 1}
            isSelected={selectedHospital === rec.hospitalId}
            onClick={() => onSelectHospital(rec.hospitalId)}
            onOpenDetail={onOpenDetail ? () => onOpenDetail(rec.hospitalId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function HospitalCard({
  recommendation,
  rank,
  isSelected,
  onClick,
  onOpenDetail,
}: {
  recommendation: HospitalRecommendation;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
  onOpenDetail?: () => void;
}) {
  const { hospital, capacity, routing, scoring, match, recommendation: level } = recommendation;
  const { city, state } = parseAddressCityState(hospital.address);
  const trauma = formatTraumaLevel(hospital.traumaLevel);

  return (
    <div
      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-950/40"
          : "border-slate-700 bg-slate-950 hover:border-slate-600"
      }`}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex flex-1 items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
              {rank}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="mb-1 text-lg font-bold leading-tight text-white">{hospital.name}</h4>
              <p className="text-sm text-slate-400">
                {city && state ? `${city}, ${state}` : hospital.address}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-center">
            <div
              className={`text-2xl font-bold ${
                scoring.overallScore >= 80
                  ? "text-emerald-400"
                  : scoring.overallScore >= 60
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {scoring.overallScore}
            </div>
            <div className="text-xs text-slate-500">Score</div>
          </div>
        </div>

        {capacity.diversion.isOnDiversion && (
          <div className="mb-3 rounded-lg border border-red-500 bg-red-950/30 p-2">
            <div className="text-sm font-semibold text-red-400">
              ⚠️ On {capacity.diversion.diversionType ?? "full"} diversion
            </div>
            {capacity.diversion.diversionReason && (
              <div className="mt-1 text-xs text-red-300">{capacity.diversion.diversionReason}</div>
            )}
          </div>
        )}

        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatBlock label="Distance" value={`${routing.distanceMiles.toFixed(1)} mi`} sub={`~${routing.durationLightsMinutes} min`} />
          <StatBlock
            label="ER beds"
            value={String(capacity.availability.erBeds.available)}
            sub={`of ${capacity.availability.erBeds.total}`}
            valueClass={
              capacity.availability.erBeds.available >= 3
                ? "text-emerald-400"
                : capacity.availability.erBeds.available >= 1
                  ? "text-amber-400"
                  : "text-red-400"
            }
          />
          <StatBlock label="Wait" value={String(capacity.waitTimes.erWaitMinutes)} sub="minutes" />
        </div>

        {(trauma || hospital.strokeCenter || hospital.cardiacCenter) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {trauma && (
              <span className="rounded bg-blue-900/40 px-2 py-1 text-xs font-medium text-blue-300">
                Trauma {trauma}
              </span>
            )}
            {hospital.strokeCenter && (
              <span className="rounded bg-purple-900/40 px-2 py-1 text-xs font-medium text-purple-300">
                Stroke
              </span>
            )}
            {hospital.cardiacCenter && (
              <span className="rounded bg-red-900/40 px-2 py-1 text-xs font-medium text-red-300">
                STEMI
              </span>
            )}
            {hospital.burnCenter && (
              <span className="rounded bg-orange-900/40 px-2 py-1 text-xs font-medium text-orange-300">
                Burn
              </span>
            )}
            {hospital.pediatricCapable && (
              <span className="rounded bg-emerald-900/40 px-2 py-1 text-xs font-medium text-emerald-300">
                Pediatric
              </span>
            )}
          </div>
        )}

        {match.warnings.length > 0 && (
          <div className="mb-2 space-y-1 text-xs text-amber-400">
            {match.warnings.map((w) => (
              <div key={w}>⚠️ {w}</div>
            ))}
          </div>
        )}

        {match.missingCapabilities.length > 0 && (
          <div className="mb-2 text-xs text-red-400">
            ❌ Missing: {match.missingCapabilities.join(", ")}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-700 pt-3">
          <span
            className={`font-semibold capitalize ${
              level === "OPTIMAL"
                ? "text-emerald-400"
                : level === "ACCEPTABLE"
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {RECOMMENDATION_ICONS[level]} {recommendationLabel(level)}
          </span>
          <span className="text-xs text-slate-500">
            Updated {new Date(capacity.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </button>

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-3 w-full rounded border border-slate-600 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          View details
        </button>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  sub,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded bg-slate-800 p-2">
      <div className="mb-1 text-xs text-slate-400">{label}</div>
      <div className={`font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
