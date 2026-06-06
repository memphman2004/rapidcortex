import Link from "next/link";

/** Government-safe procurement language — no unsubstantiated certification claims. */

export function PricingPaymentSection() {
  return (
    <section className="mt-20 sm:mt-24" aria-labelledby="ways-to-pay-heading">
      <div className="max-w-3xl">
        <h2 id="ways-to-pay-heading" className="text-2xl font-semibold tracking-tight text-white">
          Ways to Pay
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          Rapid Cortex supports annual contracts, pilots, purchase orders, invoice billing, and custom enterprise agreements.
          Government teams route procurement through contracting offices, PO references, and structured statements of work.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Pilots & renewals</h3>
          <p className="mt-2 text-sm text-slate-400">
            Phased pilots and term renewals align to agency budget cycles. Activation and true-ups are coordinated through
            authorized procurement workflows—Rapid Cortex does not process public self-service card payments here.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Purchase order & invoice</h3>
          <p className="mt-2 text-sm text-slate-400">
            Cities, counties, state programs, and emergency management departments often procure through PO references,
            Net-30 / Net-45 schedules, quarterly usage summaries, or annual invoicing rhythms.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Custom enterprise</h3>
          <p className="mt-2 text-sm text-slate-400">
            Dedicated environments, phased integrations, SLA-backed support, milestone implementation fees, and usage
            true-ups belong in a negotiated statement of work.
          </p>
        </div>
      </div>
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-400">
        <Link href="/rc-lite" className="text-sky-400/90 hover:text-sky-300">
          RC Lite
        </Link>{" "}
        is a separate API product from the dashboard tiers above: contract it standalone for integrations only, or add API
        capability on top of Command or Enterprise with the API Access add-on. See also{" "}
        <Link href="/solutions/vendors" className="text-sky-400/90 hover:text-sky-300">
          vendor integrations
        </Link>
        . Exact pricing stays quote-based unless your administrator publishes numbers.
      </p>
    </section>
  );
}
