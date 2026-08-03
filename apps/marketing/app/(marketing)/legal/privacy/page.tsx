import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { absoluteUrl, buildPublicPageMetadata } from "@/lib/seo";
import { LegalCanonicalRedirect } from "@/components/marketing/legal-canonical-redirect";

const DEST = "https://www.rapidcortex.us/privacy/";

/**
 * Canonical privacy policy is `/privacy`. This path only redirects so old links
 * and crawlers do not present a second, conflicting policy for A2P 10DLC review.
 */
export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "Privacy Policy | Rapid Cortex",
    description: "Redirecting to the Rapid Cortex privacy policy.",
    path: "/privacy",
  }),
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl("/privacy") },
};

export default function LegalPrivacyRedirectPage() {
  return (
    <LegalDocShell title="Privacy policy" lastReviewed="August 1, 2026">
      <LegalCanonicalRedirect href={DEST} label="Rapid Cortex privacy policy" />
      <p className="text-slate-400">
        Apps on Demand LLC d/b/a Rapid Cortex publishes a single privacy policy for the brand and SMS
        program at{" "}
        <a href={DEST} className="text-sky-400 hover:text-sky-300">
          {DEST}
        </a>
        . This /legal/privacy URL is retained only as a redirect so reviewers and older links resolve to
        that one policy.
      </p>
    </LegalDocShell>
  );
}
