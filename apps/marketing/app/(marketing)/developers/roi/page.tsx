import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { RoiCalculatorSandbox } from "./roi-calculator";

export const metadata = {
  title: "RC Lite ROI calculator",
};

export default function DevelopersRoiPage() {
  return (
    <MarketingArticleShell eyebrow="Economics" title="Dispatch + QA uplift modeling" sectionLabel="Pricing">
      <p className="leading-relaxed text-slate-200">
        Procurement teams routinely ask “what does intelligence automation buy us?” Plug your workload assumptions below—this
        model keeps math transparent enough for CJIS-aligned finance reviews without pretending it’s a certified PSA cost
        model.
      </p>
      <RoiCalculatorSandbox />
      <Link href="/developers/pricing" className="mt-14 inline-flex text-xs text-slate-400 hover:text-white">
        ← Pricing & metering
      </Link>
    </MarketingArticleShell>
  );
}
