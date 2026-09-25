import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOgShareImage, buildOrganizationJsonLd } from "@/lib/seo";
import {
  SITE_FORMER_MARKETING_ORIGIN,
  SITE_FORMER_NAME,
  SITE_MARKETING_ORIGIN,
  SITE_NAME,
  SITE_NAME_WITH_FORMER,
  SITE_SLOGAN,
} from "@/lib/site";
import {
  marketingContactSalesPath,
  marketingDemoPath,
  marketingPricingPath,
  marketingProductCorePath,
} from "@/lib/marketing-links";

export async function generateMetadata(): Promise<Metadata> {
  const title = `${SITE_FORMER_NAME} is now ${SITE_NAME}`;
  const description = `${SITE_NAME_WITH_FORMER}. Same public safety intelligence platform — new brand and primary domain at nexcortiq.us. Bookmarks and search results for rapidcortex.us redirect to matching paths.`;
  return {
    title,
    description,
    keywords: [
      "nexcort iq",
      "rapid cortex rebrand",
      "public safety software",
      "911 dispatch intelligence",
    ],
    openGraph: {
      title,
      description,
      url: absoluteUrl("/rapid-cortex"),
      siteName: SITE_NAME,
      images: [buildOgShareImage(`${SITE_FORMER_NAME} is now ${SITE_NAME}`)],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: buildOgShareImage().url, alt: buildOgShareImage().alt }],
    },
    alternates: { canonical: absoluteUrl("/rapid-cortex") },
  };
}

function marketingProductCorePathSafe(): string {
  try {
    return marketingProductCorePath();
  } catch {
    return "/product/core";
  }
}

export default function RapidCortexRebrandPage() {
  const orgJsonLd = {
    ...buildOrganizationJsonLd(),
    alternateName: SITE_FORMER_NAME,
  };
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${SITE_FORMER_NAME} is now ${SITE_NAME}`,
    url: absoluteUrl("/rapid-cortex"),
    description: `${SITE_NAME_WITH_FORMER} — rebrand announcement for agencies and partners.`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_MARKETING_ORIGIN,
    },
    about: {
      "@type": "Organization",
      name: SITE_NAME,
      alternateName: SITE_FORMER_NAME,
    },
  };

  const productCore = "/product/core";
  void marketingProductCorePathSafe;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />

      <header className="space-y-4 border-b border-slate-800 pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400/90">
          Brand update
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {SITE_FORMER_NAME} is now {SITE_NAME}
        </h1>
        <p className="max-w-2xl text-pretty text-lg leading-relaxed text-slate-300">
          {SITE_NAME_WITH_FORMER} — the same real-time public safety intelligence platform, under
          our current brand. {SITE_SLOGAN}.
        </p>
      </header>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-medium text-white">What changed</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Product name: <strong className="font-medium text-slate-100">{SITE_FORMER_NAME}</strong>{" "}
            → <strong className="font-medium text-slate-100">{SITE_NAME}</strong>
          </li>
          <li>
            Primary website:{" "}
            <a href={SITE_MARKETING_ORIGIN} className="text-sky-300 hover:text-sky-200">
              {SITE_MARKETING_ORIGIN.replace(/^https:\/\//, "")}
            </a>
          </li>
          <li>
            Former host{" "}
            <span className="font-mono text-slate-400">
              {SITE_FORMER_MARKETING_ORIGIN.replace(/^https:\/\//, "")}
            </span>{" "}
            issues permanent (301) redirects to the matching path on nexcortiq.us — not to the
            homepage only.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-medium text-white">What did not change</h2>
        <p>
          Contracts, agency configurations, CAD-assist workflows, Campus and Venue products, and
          support channels continue under Apps on Demand LLC. Logins and operational consoles keep
          the same paths after the domain move.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-medium text-white">Continue exploring</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {SITE_NAME} home
          </Link>
          <Link
            href={productCore}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            911 Centers / PSAPs
          </Link>
          <Link
            href={marketingPricingPath()}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            Pricing
          </Link>
          <Link
            href={marketingDemoPath()}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            Demo
          </Link>
          <a
            href={marketingContactSalesPath()}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            Contact sales
          </a>
        </div>
      </section>
    </article>
  );
}
