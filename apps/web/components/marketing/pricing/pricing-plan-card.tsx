import type { PricingPlanCardContent } from "@/lib/marketing/pricing-content";
import { PricingPlanCta } from "./pricing-plan-cta";

export function PricingPlanCard({ plan }: { plan: PricingPlanCardContent }) {
  const isHighlightCommand = plan.id === "command";
  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border border-slate-800/90 bg-slate-900/35 p-6 sm:p-7 ${
        isHighlightCommand ? "outline outline-[2.75px] outline-white" : ""
      }`}
    >
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{plan.name}</h2>
        {plan.tagline ? (
          <p className="mt-2 text-sm font-medium text-sky-200/90">{plan.tagline}</p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.descriptor}</p>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {plan.bestForTitle}
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
          {plan.bestForBullets.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-500/80" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </header>

      <div className="mt-6 border-t border-slate-800/80 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Key capabilities
        </p>
        <ul className="mt-3 space-y-2.5 text-sm leading-snug text-slate-300">
          {plan.capabilities.map((cap) => (
            <li key={cap} className="flex gap-2">
              <span className="mt-0.5 text-sky-400/90" aria-hidden>
                ✓
              </span>
              <span>{cap}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-1 flex-col justify-end border-t border-slate-800/80 pt-5">
        <p className="text-center text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Investment
        </p>
        <p className="mt-2 text-center text-sm font-semibold text-slate-200">{plan.engagementLabel}</p>
        <div className="mt-5">
          <PricingPlanCta plan={plan} />
        </div>
      </div>
    </article>
  );
}
