import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd, buildOgShareImage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Product Overview | NexCort iQ",
    description:
      "Explore NexCort iQ product lines for 911 centers, campus safety, venue command, and transit operations.",
    keywords: [
      "public safety software",
      "campus safety platform",
      "venue security software",
      "transit operations software",
      "911 dispatch intelligence",
      "incident coordination",
    ],
    openGraph: {
      title: "Product Overview | NexCort iQ",
      description: "NexCort iQ products for Core, Campus, Venue, and Transit operations.",
      url: absoluteUrl("/product"),
      siteName: "NexCort iQ",
      images: [buildOgShareImage("NexCort iQ product overview")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Product Overview | NexCort iQ",
      description: "Product lines for Core, Campus, Venue, and Transit operations.",
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
          NexCort iQ delivers decision-support and incident intelligence for
          emergency operations across core public safety, campus safety, venue command, and transit environments.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-medium text-white">Transit</h2>
          <p className="mt-2 text-sm text-slate-300">
            Fleet, route, and station operations for bus, rail, and ferry agencies.
          </p>
          <Link href="/product/transit" className="mt-4 inline-block text-sm font-medium text-sky-300 hover:text-sky-200">
            View Transit
          </Link>
        </section>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Feature deep-dives</h2>
        <p className="mt-2 text-sm text-slate-400">
          Detailed pages for specific capabilities, buyer personas, and use cases.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/nexiq", label: "NEXiQ — Non-emergency call automation" },
            { href: "/iq-vision", label: "iQ Vision — AI scene intelligence" },
            { href: "/cad-interoperability", label: "CAD-to-CAD interoperability hub" },
            { href: "/transit-safety-software", label: "Transit safety software" },
            { href: "/ai-311", label: "AI 311 and city services" },
            { href: "/campus-safety-without-app", label: "Campus safety without an app" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-sky-800/40 bg-sky-950/20 p-5">
        <h2 className="text-base font-semibold text-white">Free tools for your agency</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/nexiq/savings-calculator"
            className="text-sm font-medium text-sky-300 hover:text-sky-200"
          >
            NEXiQ workload savings calculator →
          </Link>
          <Link
            href="/modernization-assessment"
            className="text-sm font-medium text-slate-300 hover:text-slate-200"
          >
            911 modernization readiness assessment →
          </Link>
        </div>
      </section>
    </article>
  );
}

