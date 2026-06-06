import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "About | Rapid Cortex",
    description:
      "Learn about Rapid Cortex and our mission to support emergency communications teams with operational intelligence.",
    keywords: ["rapid cortex", "public safety technology", "emergency communications", "dispatch intelligence"],
    openGraph: {
      title: "About | Rapid Cortex",
      description: "Our mission and product focus for emergency response intelligence.",
      url: absoluteUrl("/about"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "About Rapid Cortex" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "About | Rapid Cortex",
      description: "Mission-focused emergency communications intelligence platform.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/about") },
  };
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">About Rapid Cortex</h1>
        <p className="text-sm text-slate-300">
          Rapid Cortex builds decision-support software for emergency communications teams operating in high-stakes,
          time-critical environments.
        </p>
      </header>
      <section className="mt-8 space-y-4 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Our focus</h2>
        <p>
          We design tools that improve situational awareness and coordination across 911 operations, campus safety, and
          venue command workflows.
        </p>
        <p>
          The platform is built to augment trained professionals with better context, not replace dispatch judgment or
          established protocols.
        </p>
        <Link href="/request-demo" className="inline-flex text-sm font-medium text-sky-300 hover:text-sky-200">
          Request a demo
        </Link>
      </section>
    </article>
  );
}

