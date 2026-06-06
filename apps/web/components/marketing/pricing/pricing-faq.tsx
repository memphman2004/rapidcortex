import { PRICING_FAQ } from "@/lib/marketing/pricing-content";

export function PricingFaq() {
  return (
    <section className="mt-20 border-t border-slate-800 pt-14 sm:mt-24 sm:pt-16" aria-labelledby="pricing-faq-heading">
      <h2 id="pricing-faq-heading" className="text-2xl font-semibold tracking-tight text-white">
        Frequently asked questions
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Straight answers for public safety IT, comms leadership, and procurement teams.
      </p>
      <div className="mt-8 space-y-3">
        {PRICING_FAQ.map((item) => (
          <details
            key={item.id}
            className="group rounded-xl border border-slate-800 bg-slate-900/25 px-4 py-3 marker:content-none [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-slate-100">
              <span className="min-w-0 flex-1 pt-2.5">{item.question}</span>
              <span
                className="mt-3 shrink-0 text-[10px] text-slate-500 transition-transform group-open:rotate-180 group-open:text-sky-400"
                aria-hidden
              >
                ▼
              </span>
            </summary>
            <p className="mt-1 border-t border-slate-800/80 pb-1 pt-3 text-sm leading-relaxed text-slate-400">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
