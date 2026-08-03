import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { absoluteUrl, buildPublicPageMetadata } from "@/lib/seo";
import { LegalCanonicalRedirect } from "@/components/marketing/legal-canonical-redirect";

const DEST = "https://www.rapidcortex.us/terms/";

/** Canonical terms are `/terms` — avoid a second conflicting legal page for A2P review. */
export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "Terms of use | Rapid Cortex",
    description: "Redirecting to the Rapid Cortex terms of use.",
    path: "/terms",
  }),
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl("/terms") },
};

export default function LegalTermsRedirectPage() {
  return (
    <LegalDocShell title="Terms of use" lastReviewed="August 1, 2026">
      <LegalCanonicalRedirect href={DEST} label="Rapid Cortex terms of use" />
      <p className="text-slate-400">
        The controlling Terms of use are published at{" "}
        <a href={DEST} className="text-sky-400 hover:text-sky-300">
          {DEST}
        </a>
        . This /legal/terms URL is retained only as a redirect.
      </p>
    </LegalDocShell>
  );
}
