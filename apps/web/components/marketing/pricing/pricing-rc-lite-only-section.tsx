import Link from "next/link";
import {
  marketingDevelopersApiPath,
  marketingRcLitePath,
  marketingContactSalesPath,
} from "@/lib/marketing-links";

export function PricingRcLiteOnlySection() {
  return (
    <section
      className="mt-16 rounded-2xl border border-sky-900/35 bg-gradient-to-br from-slate-950/90 via-slate-900/60 to-sky-950/20 p-8 sm:mt-24 sm:p-10"
      aria-labelledby="rc-lite-pricing-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">API product</p>
      <h2 id="rc-lite-pricing-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Need API access only?
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
        Rapid Cortex is the full web dashboard platform for PSAP operations. RC Lite is separate: API credentials, REST
        endpoints, webhooks, and the RC Lite portal only—no dispatcher, supervisor, QA, responder, executive, or agency
        admin applications.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href={`${marketingContactSalesPath()}?interest=api_access`}
          className="inline-flex rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-950/40 hover:bg-sky-500"
        >
          Request RC Lite Access
        </Link>
        <Link
          href={marketingRcLitePath()}
          className="inline-flex rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-400"
        >
          About RC Lite
        </Link>
        <Link href={marketingDevelopersApiPath()} className="text-sm font-medium text-sky-400 hover:text-sky-300">
          Developer API overview →
        </Link>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        RC Lite is billed and entitled separately from Rapid Cortex Essential, Command, and Enterprise. Existing
        platform customers can add the API Access add-on instead of buying RC Lite as a standalone SKU.
      </p>
    </section>
  );
}
