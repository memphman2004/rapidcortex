import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/seo";
import { NexiqCalculator } from "@/components/nexiq/nexiq-calculator";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "NEXiQ Non-Emergency Call Workload Estimator | NexCort iQ",
  description:
    "Estimate how much dispatcher capacity could be recovered by automating non-emergency calls with NEXiQ. Enter your call volume and see illustrative projections for recovered staff hours.",
  path: "/nexiq/savings-calculator",
});

export default function NexiqSavingsCalculatorPage() {
  return (
    <div className="min-h-screen bg-[#060d1a]">
      <NexiqCalculator />

      {/* SEO content below the fold — not shown above the calculator */}
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div className="mt-8 border-t border-white/[0.06] pt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">
            About this workload estimator
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-400">
            <p>
              This tool uses three configurable assumptions to estimate the dispatcher capacity
              that could potentially be recovered by automating eligible non-emergency calls:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-slate-300">Eligible call percentage:</strong> Not all
                non-emergency calls are suitable for automated intake. Noise complaints, parking
                concerns, minor property damage reports, and information requests are typically
                good candidates. Calls that require nuanced human judgment, involve distressed
                callers, or fall outside structured intake flows are not eligible.
              </li>
              <li>
                <strong className="text-slate-300">Automation/containment rate:</strong> Even among
                eligible calls, not every caller completes the automated intake flow. Some will
                opt out, some will have situations that require transfer to a human agent, and some
                will hang up before completing intake. A realistic containment rate is typically
                lower than 100%.
              </li>
              <li>
                <strong className="text-slate-300">Hourly loaded cost:</strong> This is optional
                and used only for the illustrative annual capacity value figure. It represents the
                fully loaded cost per dispatcher or call-taker hour, including benefits and overhead.
                This figure does not represent staff reductions — it represents the theoretical
                value of recovered hours that could be redirected to other work.
              </li>
            </ul>
            <p>
              Actual results from a NEXiQ deployment depend on call mix, caller behavior, agency
              policy, implementation configuration, and other factors specific to your environment.
              This calculator is a starting point for conversation, not a performance guarantee.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/nexiq"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-sky-400 hover:border-sky-700/40 hover:bg-sky-900/20"
            >
              ← NEXiQ Overview
            </a>
            <a
              href="/free-60-day-pilot"
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              Apply for a Free 60-Day Pilot
            </a>
            <a
              href="/contact-sales"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20"
            >
              Talk with Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
