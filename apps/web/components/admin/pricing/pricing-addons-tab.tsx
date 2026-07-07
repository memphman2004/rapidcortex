"use client";

import { useState } from "react";
import { PricingPriceCell } from "./pricing-price-cell";
import { ADDON_SECTIONS, type TabProps } from "@/lib/pricing/pricing-catalog";

const tableClass = "w-full border-collapse text-sm text-slate-200";
const thClass =
  "border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const tdClass = "border border-slate-700 px-3 py-2";

const cellProps = (
  props: TabProps,
  priceKey: string,
) => ({
  priceKey,
  editMode: props.editMode,
  onStage: props.onStage,
  onRevert: props.onRevert,
  getFieldProps: props.getFieldProps,
});

export function PricingAddonsTab(props: TabProps) {
  const [open, setOpen] = useState<string>("ai");

  return (
    <div className="space-y-4">
      {ADDON_SECTIONS.map((section) => {
        const isOpen = open === section.id;
        return (
          <div key={section.id} className="rounded-xl border border-slate-700">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white hover:bg-slate-900/50"
              onClick={() => setOpen(isOpen ? "" : section.id)}
            >
              {section.label}
              <span className="text-slate-500">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-700 p-4">
                <table className={tableClass} style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className={thClass}>Item</th>
                      <th className={thClass}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => {
                      if ("key" in row && row.key) {
                        return (
                          <tr key={row.key}>
                            <td className={tdClass}>{row.label}</td>
                            <td className={tdClass}>
                              <PricingPriceCell {...cellProps(props, row.key)} />
                            </td>
                          </tr>
                        );
                      }
                      if ("keys" in row && row.keys) {
                        return (
                          <tr key={row.label}>
                            <td className={tdClass}>{row.label}</td>
                            <td className={tdClass}>
                              <span className="inline-flex flex-wrap items-center gap-2">
                                {row.keys.map((k, i) => (
                                  <span key={k} className="inline-flex items-center gap-2">
                                    {i > 0 ? <span className="text-slate-500">/</span> : null}
                                    <PricingPriceCell {...cellProps(props, k)} />
                                  </span>
                                ))}
                              </span>
                            </td>
                          </tr>
                        );
                      }
                      if ("loKey" in row && row.loKey && row.hiKey) {
                        return (
                          <tr key={row.label}>
                            <td className={tdClass}>{row.label}</td>
                            <td className={tdClass}>
                              <span className="inline-flex items-center gap-2">
                                <PricingPriceCell {...cellProps(props, row.loKey)} />
                                <span className="text-slate-500">—</span>
                                <PricingPriceCell {...cellProps(props, row.hiKey)} />
                              </span>
                            </td>
                          </tr>
                        );
                      }
                      return null;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
