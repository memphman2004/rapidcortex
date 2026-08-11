"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { fetchTalkingPoints } from "@/lib/rapid-iq/api";
import type { RapidIqOpportunity } from "@/lib/rapid-iq/types";

type Props = {
  opportunity: RapidIqOpportunity;
  demo?: boolean;
};

export function TalkingPointsSection({ opportunity, demo = false }: Props) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<string[] | null>(
    opportunity.talkingPoints?.length ? opportunity.talkingPoints : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (points?.length) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchTalkingPoints(opportunity.opportunityId, demo);
      if (!next.length) {
        setError("No talking points returned — try again");
        return;
      }
      setPoints(next);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate talking points");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void load()}
        className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
      >
        <Sparkles size={11} />
        {loading ? "Generating…" : "Talking Points"}
        {points && points.length > 0 && (
          <ChevronDown size={11} className={open ? "rotate-180 transition-transform" : ""} />
        )}
      </button>
      {error && <div className="mt-2 text-[10px] text-red-400">{error}</div>}
      {open && points && points.length > 0 && (
        <div className="mt-3 space-y-1.5 border-l-2 border-sky-500/30 pl-3">
          {points.map((point, i) => (
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
