import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "DPA | Rapid Cortex",
    description: "Data Processing Addendum summary for Rapid Cortex customer and partner engagements.",
    keywords: ["data processing addendum", "DPA", "rapid cortex compliance", "public safety data processing"],
    openGraph: {
      title: "DPA | Rapid Cortex",
      description: "Data processing terms and controls summary for Rapid Cortex engagements.",
      url: absoluteUrl("/legal/dpa"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex DPA" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "DPA | Rapid Cortex",
      description: "Data processing addendum summary.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/legal/dpa") },
  };
}

export default function LegalDpaPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Data Processing Addendum (DPA)</h1>
        <p className="text-sm text-slate-300">
          Rapid Cortex can provide a contractual DPA for customer and partner engagements that defines data roles,
          processing purposes, and control responsibilities.
        </p>
      </header>
      <section className="mt-8 space-y-3 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Commercial process</h2>
        <p>
          Final DPA language is provided during procurement and legal review. Contact our support team to request the
          latest template.
        </p>
      </section>
    </article>
  );
}

