import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Request Demo | Rapid Cortex",
    description:
      "Request a Rapid Cortex demo for public safety, campus safety, or venue operations teams.",
    keywords: ["request demo", "public safety demo", "campus safety demo", "venue security demo"],
    openGraph: {
      title: "Request Demo | Rapid Cortex",
      description: "Talk with Rapid Cortex about a guided product demonstration.",
      url: absoluteUrl("/request-demo"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Request a Rapid Cortex demo" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Request Demo | Rapid Cortex",
      description: "Book a guided demo with Rapid Cortex.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/request-demo") },
  };
}

export default function RequestDemoPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Request a Demo</h1>
        <p className="text-sm text-slate-300">
          Tell us about your agency or operations environment and we will coordinate a relevant walkthrough.
        </p>
      </header>
      <section className="mt-8 space-y-4 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Next steps</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Share your operational environment and priorities.</li>
          <li>We align a demo scenario to your workflows.</li>
          <li>Your team reviews fit, rollout approach, and procurement path.</li>
        </ul>
        <nav className="flex flex-wrap gap-3">
          <Link
            href="/contact-sales?interest=demo"
            className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Start Demo Request
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center rounded-md border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Contact Support
          </Link>
        </nav>
      </section>
    </article>
  );
}

