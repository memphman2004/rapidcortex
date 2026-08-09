"use client";

import type { RapidIqVertical } from "@/lib/rapid-iq/types";

const TABS: { id: RapidIqVertical; label: string }[] = [
  { id: "911", label: "911 / PSAP" },
  { id: "campus", label: "Campus" },
  { id: "venue", label: "Venue" },
];

type Props = {
  value: RapidIqVertical;
  onChange: (vertical: RapidIqVertical) => void;
};

export function VerticalTabs({ value, onChange }: Props) {
  return (
    <div className="flex rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] p-0.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
            value === tab.id
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
