import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Terms | Rapid Cortex",
    description: "Terms for accessing Rapid Cortex public marketing properties and platform services.",
    keywords: ["terms of use", "rapid cortex terms", "public safety software terms"],
    openGraph: {
      title: "Terms | Rapid Cortex",
      description: "Terms for Rapid Cortex marketing and platform access.",
      url: absoluteUrl("/legal/terms"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex terms" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Terms | Rapid Cortex",
      description: "Terms for Rapid Cortex marketing and platform access.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/legal/terms") },
  };
}

export default function LegalTermsPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Terms</h1>
        <p className="text-sm text-slate-300">
          Use of Rapid Cortex services is governed by agreed commercial terms, implementation scope, and security
          controls.
        </p>
      </header>
      <section className="mt-8 space-y-3 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Scope and responsibility</h2>
        <p>
          Rapid Cortex is a decision-support platform and does not replace CAD systems, telephony, medical direction,
          or agency protocols.
        </p>
        <p>
          Data processing terms are documented in the{" "}
          <Link href="/legal/dpa" className="text-sky-300 hover:text-sky-200">
            Data Processing Addendum
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

