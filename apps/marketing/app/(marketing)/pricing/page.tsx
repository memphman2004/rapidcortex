import type { Metadata } from "next";
import Link from "next/link";
import { ADDONS } from "@/lib/addons";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pricing | Rapid Cortex",
    description: "Quote-based pricing tiers for Rapid Cortex Core, Campus, and Venue product deployments.",
    keywords: [
      "public safety pricing",
      "dispatch software pricing",
      "quote based pricing",
      "campus safety pricing",
      "venue security pricing",
    ],
    openGraph: {
      title: "Pricing | Rapid Cortex",
      description: "All plans are quote-based for agency-specific requirements.",
      url: absoluteUrl("/pricing"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex pricing" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Pricing | Rapid Cortex",
      description: "Quote-based plan tiers and add-on catalog.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/pricing") },
  };
}

const TIERS = ["Starter", "Professional", "Command", "Enterprise / Statewide"] as const;

export default function PricingPage() {
  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Rapid Cortex Pricing</h1>
        <p className="text-sm text-slate-300">
          All plans are quote-based. Contact us for pricing tailored to your agency.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-medium text-white">Plan tiers</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {TIERS.map((tier) => (
            <section key={tier} className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
              <h3 className="text-base font-semibold text-slate-100">{tier}</h3>
              <nav className="mt-4 flex gap-2">
                <Link
                  href="/request-demo"
                  className="inline-flex min-h-10 items-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  Request Demo
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-10 items-center rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Contact
                </Link>
              </nav>
            </section>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium text-white">Add-ons</h2>
        <p className="mt-2 text-sm text-slate-300">Name and description overview for some of our 75+ add-on features</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {ADDONS.map((addon) => (
            <li key={addon.name} className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{addon.name}</h3>
              <p className="mt-2 text-sm text-slate-300">{addon.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
