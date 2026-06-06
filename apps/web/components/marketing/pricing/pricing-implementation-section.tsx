export function PricingImplementationSection() {
  const factors = [
    "Number of console positions and concurrent operators",
    "Number of physical sites and jurisdictions on the platform",
    "Agency size, call volume, and seasonal peaks",
    "Deployment complexity (greenfield, migration, or hybrid)",
    "Enabled modules and phased rollout sequence",
    "Integration requirements (CAD, GIS, identity, logging, and partner systems)",
    "Support level, response windows, and escalation expectations",
    "Retention, storage, and evidence-handling policies",
  ];

  return (
    <section
      className="mt-20 rounded-3xl border border-slate-800/90 bg-slate-900/30 px-6 py-12 sm:mt-24 sm:px-10 sm:py-14"
      aria-labelledby="pricing-impl-heading"
    >
      <h2 id="pricing-impl-heading" className="text-2xl font-semibold tracking-tight text-white">
        Implementation, onboarding, and how scope drives investment
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
        Rapid Cortex is priced as a mission-critical operations platform—not a flat per-seat SaaS
        SKU. What you invest reflects the real surface area of your deployment: how many people rely
        on it under peak load, how many sites and integrations must stay in sync, and how stringent
        your compliance and retention rules are.
      </p>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
        Every production rollout includes <strong className="font-semibold text-slate-200">scoped onboarding and deployment planning</strong>{" "}
        so ECC leadership, IT, and procurement share the same milestones. We align modules to your
        first operational window, then phase advanced capabilities as governance and training keep
        pace—without hiding integration work inside an opaque monthly line.
      </p>
      <div className="mt-10">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Factors we align in discovery
        </h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {factors.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 px-4 py-3 text-sm text-slate-300"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
