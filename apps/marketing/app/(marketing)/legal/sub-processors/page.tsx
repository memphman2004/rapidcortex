import Link from "next/link";
import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Sub-processors | Rapid Cortex",
  description: `Third-party sub-processors ${SITE_NAME} uses to deliver contracted public-safety services.`,
  path: "/legal/sub-processors",
});

const NAV = [
  { href: "#list", label: "Sub-processors" },
  { href: "#ai", label: "AI training" },
  { href: "#contact", label: "Contact" },
] as const;

export default function SubProcessorsPage() {
  return (
    <LegalDocShell
      eyebrow="Legal"
      title="Sub-processors"
      description={`${SITE_NAME} shares data with the following categories of sub-processors solely to deliver contracted services.`}
      lastReviewed="August 23, 2026"
      navItems={NAV}
      complianceNote="This page is publicly accessible without login for partner, agency, and Ring™ Appstore review."
    >
      <p>
        {SITE_NAME} does not sell, rent, or share personal data with third parties for advertising,
        marketing, or any purpose other than delivering the contracted services. A complete list of
        sub-processors is published here. Related policy:{" "}
        <Link href="/legal/privacy">Privacy policy</Link> · <Link href="/legal/terms">Terms of use</Link>.
      </p>

      <section id="list" className="space-y-3">
        <h2 className="text-base font-semibold text-white">
          Data sharing with third parties and sub-processors
        </h2>
        <p>
          Rapid Cortex shares data with the following categories of sub-processors to deliver the
          service:
        </p>
        <ul className="ml-4 list-disc space-y-2 text-slate-400">
          <li>
            <span className="text-slate-200">Infrastructure:</span> Amazon Web Services (AWS) —
            hosting, storage, and compute
          </li>
          <li>
            <span className="text-slate-200">Communications:</span> Twilio Inc. — SMS and voice
            messaging
          </li>
          <li>
            <span className="text-slate-200">Camera integration:</span> Ring LLC (Amazon) — device
            authorization and live video streaming, solely pursuant to user consent
          </li>
          <li>
            <span className="text-slate-200">AI processing:</span> Anthropic PBC — natural language
            processing and transcription analysis under a data processing agreement
          </li>
        </ul>
        <p>
          Participating public-safety agencies (our customers) may view live Ring™ video only after the
          device owner taps Allow on that request. Ring™ video is not stored by Rapid Cortex.
        </p>
      </section>

      <section id="ai" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Use of customer data for AI model training</h2>
        <p>
          Rapid Cortex does not use customer data, incident data, call recordings, transcripts, or any
          personally identifiable information to train, fine-tune, or develop AI or machine learning
          models. AI functionality within Rapid Cortex is provided by third-party AI providers operating
          under data processing agreements that explicitly prohibit the use of customer data for model
          training purposes.
        </p>
      </section>

      <section id="contact" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Questions</h2>
        <p>
          Privacy inquiries and deletion requests:{" "}
          <a href="mailto:privacy@rapidcortex.us">privacy@rapidcortex.us</a>.
        </p>
      </section>
    </LegalDocShell>
  );
}
