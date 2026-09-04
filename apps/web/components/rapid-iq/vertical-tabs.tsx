"use client";

import type { RapidIqVertical } from "@/lib/rapid-iq/types";

export type FeedTab = RapidIqVertical | "competitor";

const TABS: { id: FeedTab; label: string; activeClass: string }[] = [
  { id: "911", label: "911 / PSAP", activeClass: "bg-sky-600 text-white shadow-sm" },
  { id: "campus", label: "Campus", activeClass: "bg-sky-600 text-white shadow-sm" },
  { id: "venue", label: "Venue", activeClass: "bg-sky-600 text-white shadow-sm" },
  { id: "transit", label: "Transit", activeClass: "bg-sky-600 text-white shadow-sm" },
  {
    id: "competitor",
    label: "Competitors",
    activeClass: "bg-red-600 text-white shadow-sm",
  },
];

export const FEED_TAB_LABELS: Record<FeedTab, string> = {
  "911": "911 / PSAP",
  campus: "Campus",
  venue: "Venue",
  transit: "Transit",
  competitor: "Competitors",
};

type Props = {
  value: FeedTab;
  onChange: (tab: FeedTab) => void;
  competitorCount?: number;
};

export function VerticalTabs({ value, onChange, competitorCount = 0 }: Props) {
  return (
    <div className="flex rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] p-0.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
            value === tab.id ? tab.activeClass : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          {tab.label}
          {tab.id === "competitor" && competitorCount > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[8px] font-bold text-red-400">
              {competitorCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
