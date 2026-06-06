import { Fragment } from "react";
import type { ComparisonCell } from "@/lib/marketing/pricing-content";
import { PRICING_COMPARISON } from "@/lib/marketing/pricing-content";
import { PRICING_COMPARISON_ROW_FEATURE_IDS } from "@/lib/marketing/pricing-comparison-feature-ids";
import { FeatureExplanationTooltip } from "@/components/rapid-cortex/feature-explanation-ui";
import { IconCheck, IconDash } from "./pricing-icons";
import { PricingComparisonCell } from "./pricing-comparison-cell";

const RC_LITE_LIMITED_NOTES: Record<string, string> = {
  "Role-based access control": "Service-account and API credential scopes only",
  "Core reporting": "Integration and usage reporting only",
  "Audit logs": "API and integration activity logs only",
};

function mergeTier(a: ComparisonCell, b: ComparisonCell): ComparisonCell {
  const rank: Record<ComparisonCell, number> = { full: 4, limited: 3, addon: 2, none: 1 };
  return rank[a] >= rank[b] ? a : b;
}

function Legend() {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
      <li className="flex items-center gap-2">
        <IconCheck className="h-[18px] w-[18px] shrink-0" />
        <span>Included</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="rounded border border-amber-500/35 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/95">
          Limited
        </span>
        <span>Partial in tier</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="rounded border border-sky-500/35 bg-sky-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-200/95">
          Add-on
        </span>
        <span>Available as add-on</span>
      </li>
      <li className="flex items-center gap-2">
        <IconDash />
        <span>Not in base tier</span>
      </li>
    </ul>
  );
}

export function PricingComparisonTable() {
  return (
    <section className="mt-20 sm:mt-24" aria-labelledby="pricing-compare-heading">
      <div className="max-w-3xl">
        <h2 id="pricing-compare-heading" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Capability comparison
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          Use this matrix to align internally on what belongs in your first deployment wave versus
          later phases. Your statement of work may include add-ons regardless of base tier when
          operations demand it.
        </p>
        <p className="mt-3 hidden text-sm leading-relaxed text-slate-400 md:block">
          RC Lite is an API-first Rapid Cortex offering for teams embedding intelligence in existing
          systems. It does not include the full dispatcher or desktop operational interface.
        </p>
        <Legend />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950/40 shadow-inner shadow-black/20">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[200px] bg-slate-900/95 px-4 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm"
              >
                Capability
              </th>
              <th
                scope="col"
                className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-300 sm:px-4"
              >
                Essential
              </th>
              <th
                scope="col"
                className="border-x border-sky-500/20 bg-sky-950/15 px-3 py-4 text-center text-xs font-semibold uppercase tracking-wide text-sky-100 sm:px-4"
              >
                Command (operational tier)
              </th>
              <th
                scope="col"
                className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-300 sm:px-4"
              >
                Enterprise / Statewide
              </th>
              <th
                scope="col"
                className="hidden px-3 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-300 sm:px-4 md:table-cell"
              >
                RC Lite
              </th>
            </tr>
          </thead>
          <tbody>
            {PRICING_COMPARISON.map((cat) => (
              <Fragment key={cat.category}>
                <tr className="bg-slate-900/80">
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="bg-slate-900/95 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-400"
                  >
                    {cat.category}
                  </th>
                </tr>
                {cat.rows.map((row) => (
                  <tr
                    key={`${cat.category}-${row.label}`}
                    className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/25"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[240px] bg-slate-950/90 px-4 py-3.5 text-xs font-medium leading-snug text-slate-300 backdrop-blur-sm sm:text-sm"
                    >
                      {PRICING_COMPARISON_ROW_FEATURE_IDS[row.label] ? (
                        <FeatureExplanationTooltip featureId={PRICING_COMPARISON_ROW_FEATURE_IDS[row.label]!}>
                          {row.label}
                        </FeatureExplanationTooltip>
                      ) : (
                        row.label
                      )}
                    </th>
                    <td className="border-slate-800/40 px-2 py-3.5 text-center sm:px-3">
                      <PricingComparisonCell value={row.essential} />
                    </td>
                    <td className="border-x border-sky-500/15 bg-sky-950/10 px-2 py-3.5 text-center sm:px-3">
                      <PricingComparisonCell value={mergeTier(row.professional, row.command)} />
                    </td>
                    <td className="px-2 py-3.5 text-center sm:px-3">
                      <PricingComparisonCell value={row.enterprise} />
                    </td>
                    <td className="hidden px-2 py-3.5 text-center sm:px-3 md:table-cell">
                      <PricingComparisonCell value={row.rc_lite} note={RC_LITE_LIMITED_NOTES[row.label]} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
