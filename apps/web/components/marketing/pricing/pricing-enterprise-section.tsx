import { PRICING_EXEC_DEMO_MAILTO, PRICING_SALES_MAILTO } from "@/lib/marketing/pricing-content";

export function PricingEnterpriseSection() {
  return (
    <section
      className="mt-20 sm:mt-24"
      aria-labelledby="pricing-enterprise-heading"
    >
      <div className="rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900/95 via-slate-950 to-indigo-950/30 px-6 py-12 sm:px-10 sm:py-14">
        <h2 id="pricing-enterprise-heading" className="text-2xl font-semibold tracking-tight text-white">
          Government, statewide, and large-agency procurement
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Rapid Cortex is built for agencies that answer to councils, boards, and oversight
          bodies. Our sales motion is procurement-friendly: documented packaging, clear module
          boundaries, pilots and phased rollouts, multi-site and regional deployment planning, and
          optional custom security and compliance review aligned to CJIS-aware expectations.
        </p>
        <ul className="mt-8 max-w-3xl space-y-3 text-sm text-slate-300">
          <li className="flex gap-3">
            <span className="text-sky-400" aria-hidden>
              ✓
            </span>
            <span>Structured statements of work with explicit integration and training deliverables.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-sky-400" aria-hidden>
              ✓
            </span>
            <span>Executive demos and stakeholder walkthroughs for command, IT, and legal reviewers.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-sky-400" aria-hidden>
              ✓
            </span>
            <span>Implementation planning that respects cutover windows and mutual aid partners.</span>
          </li>
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href={PRICING_SALES_MAILTO}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Talk to Sales
          </a>
          <a
            href={PRICING_EXEC_DEMO_MAILTO}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-500 bg-transparent px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-400 hover:bg-slate-900/40"
          >
            Schedule an Executive Demo
          </a>
        </div>
      </div>
    </section>
  );
}
