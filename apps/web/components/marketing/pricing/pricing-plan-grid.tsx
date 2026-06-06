import { PRICING_PLATFORM_PLANS } from "@/lib/marketing/pricing-content";
import { PricingPlanCard } from "./pricing-plan-card";

export function PricingPlanGrid() {
  return (
    <section className="mt-16 sm:mt-20" aria-labelledby="pricing-plans-heading">
      <div className="max-w-2xl">
        <h2 id="pricing-plans-heading" className="text-2xl font-semibold tracking-tight text-white">
          Rapid Cortex platform plans
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          Dispatcher, supervisor, and agency admin web applications with live incident workflows. Exact SKUs remain
          quote-based unless your Rapid Cortex administrator enables public pricing indicators in configuration.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
        {PRICING_PLATFORM_PLANS.map((plan) => (
          <PricingPlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </section>
  );
}
