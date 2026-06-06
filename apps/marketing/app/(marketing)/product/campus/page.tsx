import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RC Campus | Rapid Cortex",
    description:
      "Rapid Cortex Campus brings incident coordination and communications intelligence to university and K-12 safety operations.",
    keywords: [
      "campus safety software",
      "university emergency communications",
      "k-12 safety platform",
      "campus dispatch",
      "campus incident reporting",
    ],
    openGraph: {
      title: "RC Campus | Rapid Cortex",
      description: "Safety intelligence for every campus.",
      url: absoluteUrl("/product/campus"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex Campus" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "RC Campus | Rapid Cortex",
      description: "Campus safety intelligence for universities and K-12 teams.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/product/campus") },
  };
}

export default function ProductCampusPage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">RC Campus</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Safety Intelligence for Every Campus</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Built for university campus police, K-12 safety officers, and emergency management coordinators.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-medium text-white">Key capabilities</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Incident coordination</li>
          <li>Real-time communications intelligence</li>
          <li>Officer dispatch support</li>
          <li>Building access monitoring workflows</li>
          <li>Service call management</li>
          <li>Operational reporting</li>
        </ul>
      </section>

      <section className="mt-8">
        <Link
          href="/request-demo?segment=campus"
          className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Talk to Campus Sales
        </Link>
      </section>
    </article>
  );
}

