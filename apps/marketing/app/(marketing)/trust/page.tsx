import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { marketingContactPath, marketingSecurityPath } from "@/lib/marketing-links";
import { RC_LITE_TRUST_CENTER_SECTIONS } from "rapid-cortex-shared";

export const metadata = {
  title: "Trust & Compliance Disclosures | Rapid Cortex",
  description:
    "Alignment-based trust disclosures for agencies and CAD vendors — CJIS control mapping, encryption, audit logging, tenant isolation, and operational transparency.",
};

export default function RapidCortexTrustCenterPage() {
  const contact = marketingContactPath();
  const security = marketingSecurityPath();

  return (
    <MarketingArticleShell eyebrow="Trust & operations" title="Compliance disclosures & assurance topics" sectionLabel="Trust">
      <p className="text-base leading-relaxed text-slate-200">
        For <strong>procurement, legal, and security reviewers</strong> who need disclosure language before a formal
        questionnaire. We describe <strong>control intent and alignment</strong> — not formal certifications — unless your
        contract references executed accreditation artifacts.
      </p>
      <p className="text-sm text-slate-400">
        Start with the{" "}
        <Link href={security} className="font-medium text-sky-300 hover:text-sky-200">
          security posture overview
        </Link>{" "}
        for a top-level summary; use this page for topic-by-topic disclosures.
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
        Security contact pathways, executed DPAs/BAA packages, CJIS SLA riders, SOC 2 reports, uptime exports, and vendor
        questionnaires — request those artifacts through{" "}
        <Link href={contact} className="text-sky-400/90 hover:text-sky-300">
          sales &amp; operations
        </Link>
        ; this page is explanatory only.
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
