import type { Metadata } from "next";
import { NewsletterHero } from "@/components/newsletter/NewsletterHero";
import { NextIssueBanner } from "@/components/newsletter/NextIssueBanner";
import { NewsletterIndexClient } from "@/components/newsletter/NewsletterIndexClient";
import { getPublishedIssues } from "@/lib/newsletter/newsletter-data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.nexcortiq.us";

export const metadata: Metadata = {
  title: "The NexCortiQ Signal | Newsletter",
  description:
    "Monthly intelligence for 911, campus, transit, and venue safety professionals. Full editions are free to read; email previews are optional.",
  alternates: { canonical: `${SITE_URL}/newsletter` },
  openGraph: {
    type: "website",
    title: "The NexCortiQ Signal",
    description:
      "Monthly intelligence across PSAP, campus, transit, and venue — searchable archive, no paywall.",
    url: `${SITE_URL}/newsletter`,
    siteName: "NexCort iQ",
  },
};

export default function NewsletterIndexPage() {
  const published = getPublishedIssues();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "The NexCortiQ Signal",
    url: `${SITE_URL}/newsletter`,
    publisher: { "@type": "Organization", name: "NexCort iQ", url: SITE_URL },
    hasPart: published.map((issue) => ({
      "@type": "NewsArticle",
      headline: issue.title,
      url: `${SITE_URL}/newsletter/${issue.slug}`,
      datePublished: issue.publishDate,
    })),
  };

  return (
    <div className="min-h-screen" style={{ background: "#0A1628" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NewsletterHero />
      <NextIssueBanner />
      <NewsletterIndexClient />
    </div>
  );
}
