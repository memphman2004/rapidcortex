import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { marketingNestConnectPath, marketingRingCustomersPath } from "@/lib/marketing-links";
import { RC_LITE_PRODUCT_BUNDLES, RC_LITE_VERTICAL_MARKETS } from "rapid-cortex-shared";

export const metadata = {
  title: "Rapid Cortex integrations & adapters",
};

const ADAPTER_TARGETS = [
  "Ring™ doorbell & camera Connect (consent-based emergency video)",
  "Google Nest™ SDM cameras (agency-linked + citizen consent requests)",
  "CAD RMS cores (motorola-central, centralsquare, Tyler, Mark43-compatible)",
  "RMS ingestion + RMS exports",
  "Twilio & vendor telephony gateways",
  "Amazon Kinesis Video Streams + WebRTC",
  "Microsoft Teams & Slack escalation (non-emergency tiers)",
  "ServiceNow + WebEOC incident bridges",
  "ArcGIS Online / authoritative GIS ingestion",
];

export default function IntegrationsLandingPage() {
  return (
    <MarketingArticleShell eyebrow="Ecosystem" title="Marketplace adapters (roadmap scaffolding)" sectionLabel="Partners">
      <p className="leading-relaxed text-slate-200">
        Rapid Cortex publishes opinionated ingestion contracts first, then progressively ships adapter templates tuned to your
        agency’s toolchain. Today’s page inventories what OEM + PSAP onboarding teams prioritize — real connectors land on a
        per-contract basis with RCA validation.
      </p>
      <section className="mt-14 space-y-6">
        <h2 className="text-xl font-semibold text-white">Vertical narratives</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {RC_LITE_VERTICAL_MARKETS.map((row) => (
            <article key={row.id} className="rounded-3xl border border-white/10 bg-black/55 p-5 text-sm">
              <h3 className="text-lg font-semibold text-sky-200">{row.packageName}</h3>
              <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-500">{row.label}</p>
              <p className="mt-4 text-slate-300">{row.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <h2 className="text-xl font-semibold text-white">Technical bundles powering adapters</h2>
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          {RC_LITE_PRODUCT_BUNDLES.map((bundle) => (
            <article key={bundle.id} className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-neutral-950/95 p-6">
              <h3 className="text-lg font-semibold text-white">{bundle.label}</h3>
              <p className="mt-2 text-slate-400">{bundle.summary}</p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.45em] text-slate-500">
                scopes: {bundle.scopes.join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">Adapter backlog snapshots</h2>
        <ul className="mt-5 list-disc space-y-3 pl-5 text-sm text-slate-300">
          {ADAPTER_TARGETS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap gap-8 text-xs text-slate-400">
        <a href={marketingNestConnectPath()} className="hover:text-white">
          Nest™ Connect →
        </a>
        <a href={marketingRingCustomersPath()} className="hover:text-white">
          Ring™ Connect →
        </a>
        <Link href="/developers" className="hover:text-white">
          Developers hub →
        </Link>
        <Link href="/trust" className="hover:text-white">
          Trust disclosures →
        </Link>
      </div>
    </MarketingArticleShell>
  );
}
