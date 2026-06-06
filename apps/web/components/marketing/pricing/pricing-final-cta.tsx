import { PricingFinalCtaButtons } from "./pricing-final-cta-buttons";

export function PricingFinalCta() {
  return (
    <section
      className="mt-20 rounded-3xl border border-sky-500/25 bg-gradient-to-br from-sky-950/40 via-slate-900/80 to-slate-950 px-6 py-12 text-center sm:mt-24 sm:px-10 sm:py-14"
      aria-labelledby="pricing-final-heading"
    >
      <h2 id="pricing-final-heading" className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Ready to see Rapid Cortex in action?
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
        Schedule a tailored walkthrough to explore the right deployment for your agency, center, or
        regional command environment. We will meet you at the depth your operations require—no
        bait-and-switch tiers, and procurement through agency-approved channels only.
      </p>
      <div className="mt-8 flex justify-center">
        <PricingFinalCtaButtons />
      </div>
    </section>
  );
}
