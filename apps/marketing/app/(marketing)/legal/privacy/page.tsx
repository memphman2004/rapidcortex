import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Privacy | Rapid Cortex",
    description: "Privacy terms and data-handling overview for Rapid Cortex marketing and product experiences.",
    keywords: ["privacy policy", "rapid cortex privacy", "public safety data privacy"],
    openGraph: {
      title: "Privacy | Rapid Cortex",
      description: "Privacy and data-handling overview for Rapid Cortex.",
      url: absoluteUrl("/legal/privacy"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex privacy policy" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Privacy | Rapid Cortex",
      description: "Privacy and data-handling overview.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/legal/privacy") },
  };
}

export default function LegalPrivacyPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Privacy</h1>
        <p className="text-sm text-slate-300">
          Rapid Cortex follows role-scoped access and tenant boundaries. Data handling details may vary by contract and
          deployment profile.
        </p>
      </header>
      <section className="mt-8 space-y-3 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Questions</h2>
        <p>
          For privacy requests, contact{" "}
          <a className="text-sky-300 hover:text-sky-200" href="mailto:privacy@rapidcortex.us">
            privacy@rapidcortex.us
          </a>
          .
        </p>
        <p>
          For additional legal terms, review{" "}
          <Link href="/legal/terms" className="text-sky-300 hover:text-sky-200">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/dpa" className="text-sky-300 hover:text-sky-200">
            DPA
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

