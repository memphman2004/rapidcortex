import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { RC_LITE_TRUST_CENTER_SECTIONS } from "rapid-cortex-shared";

export const metadata = {
  title: "Rapid Cortex — Trust Center (RC Lite)",
};

export default function RapidCortexTrustCenterPage() {
  return (
    <MarketingArticleShell eyebrow="Assurance" title="Trust & compliance disclosures" sectionLabel="RC Lite">
      <p className="leading-relaxed text-slate-200">
        Agencies and CAD vendors scrutinize attestations harder than SaaS KPIs — we disclose control intent without claiming
        formal certifications until evidence exists. Language stays <strong className="text-white">alignment</strong>-based unless your contract
        references executed accreditation artifacts.
      </p>
      <div className="mt-14 space-y-10 text-sm leading-relaxed text-slate-300">
        {RC_LITE_TRUST_CENTER_SECTIONS.map((section) => (
          <article key={section.id} className="rounded-3xl border border-white/15 bg-black/55 p-6">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <p className="mt-4 text-slate-300">{section.summary}</p>
          </article>
        ))}
      </div>
      <p className="mt-14 text-[11px] text-slate-500">
        Security contact pathways, executed DPAs/BAA packages, CJIS SLA riders, SOC 2 reports, uptime exports, vendor
        questionnaires — request those artifacts through your onboarding team; this page is explanatory only.
      </p>
      <div className="mt-14 flex gap-10 text-xs text-slate-400">
        <Link className="hover:text-white" href="/developers/status">
          Service transparency
        </Link>
        <Link className="hover:text-white" href="/integrations">
          Integration adapters
        </Link>
      </div>
    </MarketingArticleShell>
  );
}
