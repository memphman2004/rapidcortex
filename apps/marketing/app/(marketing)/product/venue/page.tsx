import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RC Venue | Rapid Cortex",
    description:
      "Rapid Cortex Venue provides command-level awareness for stadium, arena, and event security operations.",
    keywords: [
      "venue security software",
      "stadium command platform",
      "event operations software",
      "crowd monitoring tools",
      "venue incident coordination",
    ],
    openGraph: {
      title: "RC Venue | Rapid Cortex",
      description: "Command-level awareness for every event.",
      url: absoluteUrl("/product/venue"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex Venue" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "RC Venue | Rapid Cortex",
      description: "Venue and event command intelligence for security teams.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/product/venue") },
  };
}

export default function ProductVenuePage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">RC Venue</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Command-Level Awareness for Every Event</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Designed for venue security directors, event operations teams, and stadium command staff.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-medium text-white">Key capabilities</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Crowd density monitoring</li>
          <li>Gate access control operations</li>
          <li>Unit tracking support</li>
          <li>Incident coordination</li>
          <li>Event operations workflows</li>
          <li>Post-event reporting</li>
        </ul>
      </section>

      <section className="mt-8">
        <Link
          href="/request-demo?segment=venue"
          className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Talk to Venue Sales
        </Link>
      </section>
    </article>
  );
}

