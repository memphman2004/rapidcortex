import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd, buildOgShareImage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Product Overview | NexCort iQ",
    description:
      "Explore NexCort iQ (formerly Rapid Cortex) product lines for core public safety operations, campus safety teams, and venue command environments.",
    keywords: [
      "public safety software",
      "campus safety platform",
      "venue security software",
      "911 dispatch intelligence",
      "incident coordination",
    ],
    openGraph: {
      title: "Product Overview | NexCort iQ",
      description: "NexCort iQ products for Core, Campus, and Venue operations.",
      url: absoluteUrl("/product"),
      siteName: "NexCort iQ",
      images: [buildOgShareImage("NexCort iQ product overview")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Product Overview | NexCort iQ",
      description: "Product lines for Core, Campus, and Venue operations.",
      images: [{ url: buildOgShareImage().url, alt: buildOgShareImage().alt }],
    },
    alternates: { canonical: absoluteUrl("/product") },
  };
}

export default function ProductOverviewPage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">NexCort iQ Product Overview</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          NexCort iQ, formerly Rapid Cortex, delivers decision-support and incident intelligence for
          emergency operations across core public safety, campus safety, and venue command environments.
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-medium text-white">911 Centers/PSAPs</h2>
          <p className="mt-2 text-sm text-slate-300">
            911, EMS, fire, and law enforcement workflows with AI-assisted call intelligence.
          </p>
          <Link href="/product/core" className="mt-4 inline-block text-sm font-medium text-sky-300 hover:text-sky-200">
            View 911 Centers/PSAPs
          </Link>
        </section>
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-medium text-white">Campus</h2>
          <p className="mt-2 text-sm text-slate-300">
            Campus safety intelligence for university and K-12 operations teams.
          </p>
          <Link href="/product/campus" className="mt-4 inline-block text-sm font-medium text-sky-300 hover:text-sky-200">
            View Campus
          </Link>
        </section>
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-medium text-white">Venue</h2>
          <p className="mt-2 text-sm text-slate-300">
            Event and venue command awareness for stadium and arena operations.
          </p>
          <Link href="/product/venue" className="mt-4 inline-block text-sm font-medium text-sky-300 hover:text-sky-200">
            View Venue
          </Link>
        </section>
      </section>
    </article>
  );
}

