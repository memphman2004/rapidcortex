import { PRICING_ADDONS } from "@/lib/marketing/pricing-content";

export function PricingAddonGrid() {
  return (
    <section className="mt-20 sm:mt-24" aria-labelledby="pricing-addons-heading">
      <div className="max-w-3xl">
        <h2 id="pricing-addons-heading" className="text-2xl font-semibold tracking-tight text-white">
          Optional add-ons
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          Extend your deployment with packages that match your CAD vendor, geography, compliance
          posture, and sustainment model. Each add-on is scoped and contracted separately so
          procurement stays transparent.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRICING_ADDONS.map((addon) => (
          <li
            key={addon.id}
            className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/35 p-5 transition hover:border-slate-700 hover:bg-slate-900/50"
          >
            <h3 className="text-sm font-semibold text-white">{addon.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{addon.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
