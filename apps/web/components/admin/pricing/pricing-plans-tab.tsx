"use client";

import { useState } from "react";
import { PricingPriceCell } from "./pricing-price-cell";
import { PSAP_PLANS, PSAP_TIERS, type TabProps } from "@/lib/pricing/pricing-catalog";

const tableClass =
  "w-full border-collapse text-sm text-slate-200";
const thClass =
  "border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const tdClass = "border border-slate-700 px-3 py-2 align-top";

export function PricingPlansTab(props: TabProps) {
  const { editMode, onStage, onRevert, getFieldProps } = props;
  const [planId, setPlanId] = useState<string>("ess");
  const plan = PSAP_PLANS.find((p) => p.id === planId) ?? PSAP_PLANS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[...PSAP_PLANS, { id: "ent", label: "Enterprise" }].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlanId(p.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              planId === p.id
                ? "bg-violet-600 text-white"
                : "border border-slate-700 text-slate-300 hover:bg-slate-900"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {planId === "ent" ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
          Enterprise pricing is negotiated per contract. Master guide defaults are not editable here —
          use tenant overrides for agency-specific enterprise quotes.
        </p>
      ) : (
        <>
          <table className={tableClass} style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className={thClass} style={{ width: 140 }}>
                  Fee type
                </th>
                {PSAP_TIERS.map((tier) => (
                  <th key={tier.id} className={thClass}>
                    <div>{tier.label}</div>
                    <div className="mt-1 font-normal normal-case text-slate-500">{tier.seats}</div>
                    <div className="font-normal normal-case text-slate-500">{tier.volume}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.id}>
                  <td className={tdClass}>{row.label}</td>
                  {PSAP_TIERS.map((tier) => {
                    const key = `${plan.id}.${tier.id}.${row.id}`;
                    return (
                      <td key={tier.id} className={tdClass}>
                        <PricingPriceCell
                          priceKey={key}
                          suffix={row.suffix}
                          editMode={editMode}
                          onStage={onStage}
                          onRevert={onRevert}
                          getFieldProps={getFieldProps}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-3 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-white">Seat overages</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-400">
                Dispatcher seats {plan.dispatcherOvrFrom}+
              </span>
              <PricingPriceCell
                priceKey={`${plan.id}.ovr.dispatcher`}
                suffix="/seat/mo"
                editMode={editMode}
                onStage={onStage}
                onRevert={onRevert}
                getFieldProps={getFieldProps}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-400">Admin seats {plan.adminOvrFrom}+</span>
              <PricingPriceCell
                priceKey={`${plan.id}.ovr.admin`}
                suffix="/seat/mo"
                editMode={editMode}
                onStage={onStage}
                onRevert={onRevert}
                getFieldProps={getFieldProps}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
