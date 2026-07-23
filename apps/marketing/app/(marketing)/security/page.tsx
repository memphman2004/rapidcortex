import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import {
  marketingContactPath,
  marketingOperationsStatusPath,
  marketingPrivacyPath,
  marketingTrustPath,
} from "@/lib/marketing-links";
import {
  SECURITY_PAGE_DISCLAIMER,
  SECURITY_PAGE_METADATA,
  TRUST_PILLARS,
} from "@/lib/trust-security-content";
import { absoluteUrl, buildOgShareImage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { title, description, keywords, openGraphImageAlt } = SECURITY_PAGE_METADATA;
  const shareImage = buildOgShareImage(openGraphImageAlt);
  return {
    title,
    description,
    keywords: [...keywords],
    openGraph: {
      title,
      description,
      url: absoluteUrl("/security"),
      siteName: "Rapid Cortex",
      images: [shareImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: shareImage.url, alt: shareImage.alt }],
    },
    alternates: { canonical: absoluteUrl("/security") },
  };
}

export default function MarketingSecurityPage() {
  const privacy = marketingPrivacyPath();
  const contact = marketingContactPath();
  const trust = marketingTrustPath();
  const status = marketingOperationsStatusPath();

  return (
    <MarketingArticleShell
      eyebrow="Trust & operations"
      title="Security posture for public safety deployments"
      sectionLabel="Trust"
    >
      <p className="text-base text-slate-200">
        This page is for <strong>IT directors, CJIS coordinators, procurement, and vendor security reviewers</strong>{" "}
        evaluating Rapid Cortex before or during a pilot. It summarizes how we protect agency data and operate the
        platform — without asking you to read the entire product first.
      </p>

      <div className="-mx-1 mt-2 grid gap-3 sm:grid-cols-2">
        {TRUST_PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4"
          >
            <p className="text-sm font-semibold text-white">{pillar.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{pillar.body}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-white">{SECURITY_PAGE_DISCLAIMER.heading}</h2>
        <p>
          {SECURITY_PAGE_DISCLAIMER.bodyLead}
          <strong>{SECURITY_PAGE_DISCLAIMER.bodyNegation}</strong>
          {SECURITY_PAGE_DISCLAIMER.bodyRest}
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-white">What you can request for review</h2>
        <ul>
          <li>Security and architecture overview tailored to your agency or program.</li>
          <li>Control-mapping narrative for CJIS Security Policy areas relevant to your deployment.</li>
          <li>Subprocessor and infrastructure disclosure for procurement packets.</li>
          <li>Privacy, retention, and data-handling summaries aligned to your contract language.</li>
          <li>Completed vendor security questionnaires — handled collaboratively with your IT team.</li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-white">Technical controls summary</h2>
        <ul>
          <li>HTTPS for web experiences and programmatic access; JWT authorizer on protected API routes.</li>
          <li>Role-based access tied to agency tenancy, with separate platform administration boundaries.</li>
          <li>Encryption at rest for managed data stores; optional stronger key management during deployment.</li>
          <li>Policy against logging raw secrets, tokens, and full unredacted transcripts in application logs.</li>
          <li>Media intake uses private storage with short-lived, controlled retrieval where configured.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 px-4 py-4">
        <p className="text-sm font-medium text-sky-100">Next steps</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>
            <Link href={contact} className="font-medium text-sky-300 hover:text-sky-200">
              Contact sales &amp; operations
            </Link>{" "}
            — security questionnaires, pilot scoping, and procurement packets.
          </li>
          <li>
            <Link href={trust} className="font-medium text-sky-300 hover:text-sky-200">
              Trust &amp; compliance disclosures
            </Link>{" "}
            — RC Lite assurance topics and artifact intent (explanatory, not certification claims).
          </li>
          <li>
            <Link href={status} className="font-medium text-sky-300 hover:text-sky-200">
              System status
            </Link>{" "}
            — operational transparency for live environments.
          </li>
          <li>
            <Link href={privacy} className="font-medium text-sky-300 hover:text-sky-200">
              Privacy policy
            </Link>{" "}
            — how we handle personal and operational data.
          </li>
        </ul>
      </div>
    </MarketingArticleShell>
  );
}
