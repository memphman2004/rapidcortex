import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { RC_LITE_SIMULATION_SCENARIOS } from "rapid-cortex-shared";

export const metadata = {
  title: "RC Lite — Sandbox simulation catalogue",
};

export default function DevelopersSimulationGuidePage() {
  return (
    <MarketingArticleShell eyebrow="Demos & grants" title="Simulation payloads" sectionLabel="Developers">
      <p className="leading-relaxed text-slate-200">
        RC Lite exposes deterministic sandbox fixtures mirroring ECC stress patterns—grant writers, PIO demos, onboarding
        flights, APCO rehearsals. Nothing here touches production tenants; wire them through `simulationOnly` flags in payloads
        and separate sandbox metering lanes.
      </p>
      <div className="mt-14 space-y-8 text-sm text-slate-300">
        {RC_LITE_SIMULATION_SCENARIOS.map((scenario) => (
          <article key={scenario.id} id={scenario.id} className="rounded-3xl border border-white/10 bg-black/55 p-6">
            <h2 className="text-xl font-semibold text-white">{scenario.label}</h2>
            <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-500">{scenario.summary}</p>
            <p className="mt-6 font-mono text-[13px] text-emerald-200/95">{scenario.sampleNarrative}</p>
          </article>
        ))}
      </div>
      <Link href="/developers/playground" className="mt-14 inline-flex text-xs text-emerald-200 hover:text-white">
        Open interactive playground →
      </Link>
    </MarketingArticleShell>
  );
}
