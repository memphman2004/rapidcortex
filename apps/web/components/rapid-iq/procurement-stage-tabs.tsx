"use client";

import {
  RAPID_IQ_PROCUREMENT_STAGE_FILTERS,
  type RapidIqProcurementStageFilterId,
} from "rapid-cortex-shared";

type Props = {
  value: RapidIqProcurementStageFilterId;
  onChange: (id: RapidIqProcurementStageFilterId) => void;
};

export function ProcurementStageTabs({ value, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] p-0.5"
      role="tablist"
      aria-label="Procurement stage"
    >
      {RAPID_IQ_PROCUREMENT_STAGE_FILTERS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
            value === tab.id ? "bg-sky-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
