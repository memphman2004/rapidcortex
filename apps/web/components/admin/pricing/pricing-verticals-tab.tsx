"use client";

import { useState } from "react";
import { PricingPriceCell } from "./pricing-price-cell";
import { PSAP_TIERS, VERTICALS, type TabProps } from "@/lib/pricing/pricing-catalog";

const tableClass = "w-full border-collapse text-sm text-slate-200";
const thClass =
  "border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const tdClass = "border border-slate-700 px-3 py-2";

export function PricingVerticalsTab(props: TabProps) {
  const { editMode, onStage, onRevert, getFieldProps } = props;
  const [verticalId, setVerticalId] = useState<string>("campus");
  const vertical = VERTICALS.find((v) => v.id === verticalId) ?? VERTICALS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {VERTICALS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVerticalId(v.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              verticalId === v.id
                ? "bg-violet-600 text-white"
                : "border border-slate-700 text-slate-300 hover:bg-slate-900"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {vertical.id === "campus" && (
        <div className="flex flex-wrap gap-8 rounded-xl border border-slate-700 p-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Per enrolled student / year</span>
            <PricingPriceCell
              priceKey="campus.rate"
              decimals={2}
              editMode={editMode}
              onStage={onStage}
              onRevert={onRevert}
              getFieldProps={getFieldProps}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Minimum annual contract</span>
            <PricingPriceCell
              priceKey="campus.minimum"
              editMode={editMode}
              onStage={onStage}
              onRevert={onRevert}
              getFieldProps={getFieldProps}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {vertical.id !== "campus" && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">Annual pricing by tier</h3>
            <table className={tableClass} style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th className={thClass}>Tier</th>
                  <th className={thClass}>Annual fee</th>
                </tr>
              </thead>
              <tbody>
                {PSAP_TIERS.map((tier) => {
                  const key = `${vertical.id}.${tier.id}.annual`;
                  return (
                    <tr key={tier.id}>
                      <td className={tdClass}>{tier.label}</td>
                      <td className={tdClass}>
                        <PricingPriceCell
                          priceKey={key}
                          suffix="/yr"
                          editMode={editMode}
                          onStage={onStage}
                          onRevert={onRevert}
                          getFieldProps={getFieldProps}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-white">Implementation fee</h3>
          <table className={tableClass} style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className={thClass}>Size</th>
                <th className={thClass}>Fee</th>
              </tr>
            </thead>
            <tbody>
              {(vertical.id === "campus" ? vertical.implSizes : PSAP_TIERS).map((size) => {
                const sizeId = size.id;
                const label = size.label;
                const key =
                  vertical.id === "campus"
                    ? `campus.impl.${sizeId}`
                    : `${vertical.id}.${sizeId}.impl`;
                return (
                  <tr key={sizeId}>
                    <td className={tdClass}>{label}</td>
                    <td className={tdClass}>
                      <PricingPriceCell
                        priceKey={key}
                        editMode={editMode}
                        onStage={onStage}
                        onRevert={onRevert}
                        getFieldProps={getFieldProps}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
