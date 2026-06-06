import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { marketingContactPath, marketingPrivacyPath } from "@/lib/marketing-links";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Security | Rapid Cortex",
    description:
      "CJIS-aligned security overview for Rapid Cortex, including identity controls, tenant boundaries, and operational safeguards.",
    keywords: [
      "cjis aligned security",
      "public safety cybersecurity",
      "dispatch platform security",
      "tenant isolation",
      "security controls",
    ],
    openGraph: {
      title: "Security | Rapid Cortex",
      description: "CJIS-aligned security posture for emergency communications operations.",
      url: absoluteUrl("/security"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex security" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Security | Rapid Cortex",
      description: "CJIS-aligned security overview for Rapid Cortex.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/security") },
  };
}

export default function MarketingSecurityPage() {
  const privacy = marketingPrivacyPath();
  const contact = marketingContactPath();

  return (
    <MarketingArticleShell
      eyebrow="Trust & operations"
      title="Security, privacy, and CJIS-aligned deployment"
      sectionLabel="Trust"
    >
      <p>
        Rapid Cortex is designed for <strong>public safety workloads</strong> with strong
        authentication, least-privilege access, encryption in transit, and careful handling of
        sensitive data. This page summarizes our <strong>technical posture</strong> for procurement
        and IT conversations.
      </p>
      <p>
        <strong>Not a certification page:</strong> we do <strong>not</strong> claim CJIS, CJIS-ATP,
        FedRAMP, or SOC 2 certification here. &quot;CJIS-aligned&quot; means we document controls
        that agencies can map to the CJIS Security Policy with their assessors; your program must
        complete its own review.
      </p>
      <ul>
        <li>HTTPS for web experiences and programmatic access; JWT-authorized APIs.</li>
        <li>Role-based access tied to agency tenancy and platform administration.</li>
        <li>Encryption at rest for managed data stores; optional stronger key management during deployment.</li>
        <li>Policy against logging raw secrets, tokens, and full unredacted transcripts in application logs.</li>
        <li>Media intake uses private storage with short-lived, controlled retrieval where configured.</li>
      </ul>
      <p>
        Procurement and security questionnaires are handled collaboratively. For tailored materials beyond this summary,{" "}
        <Link href={contact} className="font-medium">
          contact us
        </Link>
        .
      </p>
      <p>
        <Link href={privacy} className="font-medium">
          Privacy policy
        </Link>
        <span className="text-slate-500"> · </span>
        <Link href={contact} className="font-medium">
          Contact
        </Link>
      </p>
    </MarketingArticleShell>
  );
}
