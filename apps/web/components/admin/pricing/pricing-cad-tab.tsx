"use client";

import { useState } from "react";
import { PricingPriceCell } from "./pricing-price-cell";
import { CAD_SECTIONS, type TabProps } from "@/lib/pricing/pricing-catalog";

const tableClass = "w-full border-collapse text-sm text-slate-200";
const thClass =
  "border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const tdClass = "border border-slate-700 px-3 py-2";

export function PricingCadTab(props: TabProps) {
  const { editMode, onStage, onRevert, getFieldProps } = props;
  const [sectionId, setSectionId] = useState<string>("disco");
  const section = CAD_SECTIONS.find((s) => s.id === sectionId) ?? CAD_SECTIONS[0];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Do not include CAD write-back in pilot base pricing — scope separately after discovery.
      </div>

      <div className="flex flex-wrap gap-2">
        {CAD_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSectionId(s.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              sectionId === s.id
                ? "bg-sky-700 text-white"
                : "border border-slate-700 text-slate-300 hover:bg-slate-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <table className={tableClass} style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th className={thClass} style={{ width: "50%" }}>
              Tier / Item
            </th>
            <th className={thClass}>Fee</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.key}>
              <td className={tdClass}>{row.label}</td>
              <td className={tdClass}>
                <PricingPriceCell
                  priceKey={row.key}
                  editMode={editMode}
                  onStage={onStage}
                  onRevert={onRevert}
                  getFieldProps={getFieldProps}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
