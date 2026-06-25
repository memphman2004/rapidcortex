import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import {
  marketingContactPath,
  marketingOperationsStatusPath,
  marketingPrivacyPath,
  marketingTrustPath,
} from "@/lib/marketing-links";
import { absoluteUrl } from "@/lib/seo";

const TRUST_PILLARS = [
  {
    title: "Identity & access",
    body: "Cognito-backed sign-in with MFA for privileged roles, JWT-authorized APIs, and role-based access scoped to agency tenancy — not URL parameters.",
  },
  {
    title: "Tenant isolation",
    body: "Operational data is partitioned by agency. Cross-tenant reads and writes are denied by default in application and API layers.",
  },
  {
    title: "Encryption",
    body: "TLS for web and API traffic; encryption at rest on managed data stores, with stronger key management available at deployment.",
  },
  {
    title: "Audit & logging",
    body: "Meaningful state changes emit audit events. Application logs avoid raw secrets, tokens, and full unredacted transcripts.",
  },
  {
    title: "Media & intake",
    body: "Caller-submitted media uses private storage with short-lived, controlled retrieval where configured.",
  },
  {
    title: "Operations",
    body: "Deployment, monitoring, and incident response are documented for review. SIEM and 24/7 response are production-tier options, not the pilot default.",
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const title = "Trust & Operations | Rapid Cortex";
  const description =
    "Security, privacy, and operational posture for public safety teams — identity controls, tenant isolation, encryption, and CJIS-aligned control mapping for procurement review.";
  return {
    title,
    description,
    keywords: [
      "cjis aligned security",
      "public safety cybersecurity",
      "dispatch platform security",
      "tenant isolation",
      "security controls",
      "psap procurement security",
      "emergency communications security",
    ],
    openGraph: {
      title,
      description,
      url: absoluteUrl("/security"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex trust and security" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/api/og")],
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
        <h2 className="text-base font-semibold text-white">What we do not claim on this page</h2>
        <p>
          Rapid Cortex does <strong>not</strong> assert CJIS, CJIS-ATP, or FedRAMP certification on this page. We have
          not completed a SOC 2 audit. &quot;CJIS-aligned&quot; means we document controls your assessors can map to
          the CJIS Security Policy; your agency completes its own authorization path.
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
