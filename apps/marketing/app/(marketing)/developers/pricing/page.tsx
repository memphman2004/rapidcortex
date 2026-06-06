import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import Link from "next/link";
import {
  RC_LITE_ADD_ON_LABELS,
  RC_LITE_INTERNAL_PRICING_TIERS,
} from "rapid-cortex-shared";
import { showPublicRcLitePricing } from "@/lib/rc-lite/public-rc-lite-pricing-flag";

export const metadata = {
  title: "RC Lite — Internal API plans reference",
};

export default function DevelopersRcLitePricingPage() {
  const show = showPublicRcLitePricing();

  return (
    <MarketingArticleShell eyebrow="Monetization" title="API plans reference" sectionLabel="Developers · Pricing">
      {!show ? (
        <p className="leading-relaxed text-slate-300">
          Rapid Cortex RC Lite tiers are negotiated per procurement. Public marketing retains quote-only stance unless{" "}
          <span className="font-mono text-slate-400">NEXT_PUBLIC_SHOW_RC_LITE_PUBLIC_PRICING=true</span> is toggled alongside
          legal approval.
        </p>
      ) : (
        <>
          <p className="text-sm text-emerald-400">
            Preview pricing surfaced because public pricing flag enabled — verify legal + PLT sign-off before production.
          </p>
          <ul className="mt-6 space-y-4 text-sm text-slate-300">
            {RC_LITE_INTERNAL_PRICING_TIERS.map((t) => (
              <li key={t.id} className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
                <p className="font-semibold text-white">{t.label}</p>
                <p className="mt-2 text-slate-400">{t.notes}</p>
                <p className="mt-2 text-slate-300">
                  Monthly:{" "}
                  <span className="font-mono">{typeof t.monthlyUsd === "number" ? `$${t.monthlyUsd}` : t.monthlyUsd}</span> —
                  Included API calls: {t.includedApiCalls ?? "quote"} {" — "}
                  Overage{" "}
                  {typeof t.overageUsdPerCall === "number" ? `@ $${t.overageUsdPerCall}/call` : t.overageUsdPerCall ?? "quote"}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <p className="text-sm font-semibold text-white">Add-on bundles</p>
            <ul className="mt-3 list-disc pl-6 text-sm text-slate-400">
              {RC_LITE_ADD_ON_LABELS.map((lbl) => (
                <li key={lbl}>{lbl}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      <div className="mt-12">
        <Link href="/developers" className="text-sm text-sky-400 hover:text-sky-300">
          ← Developers hub
        </Link>
      </div>
    </MarketingArticleShell>
  );
}
