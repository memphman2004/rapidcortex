import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";

type LandingSection = {
  title: string;
  body: string;
  bullets?: string[];
};

type RelatedLink = {
  href: string;
  label: string;
};

type KeywordLandingPageProps = {
  title: string;
  description: string;
  path: string;
  h1: string;
  eyebrow: string;
  intro: string;
  sections: LandingSection[];
  relatedLinks: RelatedLink[];
};

export function KeywordLandingPage({
  title,
  description,
  path,
  h1,
  eyebrow,
  intro,
  sections,
  relatedLinks,
}: KeywordLandingPageProps) {
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: absoluteUrl(path),
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "Rapid Cortex",
      url: absoluteUrl("/"),
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Rapid Cortex",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Windows, macOS",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <MarketingArticleShell title={h1} eyebrow={eyebrow} sectionLabel="Solutions">
        <p>{intro}</p>

        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-base font-semibold text-white">{section.title}</h2>
            <p>{section.body}</p>
            {section.bullets ? (
              <ul className="ml-4 list-disc space-y-1 text-slate-300">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-4">
          <h2 className="text-base font-semibold text-white">Next step</h2>
          <p className="mt-2">
            Qualified agencies can evaluate Rapid Cortex through a Free 60-Day Pilot Program with
            non-disruptive deployment.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/contact-sales"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Contact Support
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-600 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              Watch demo
            </Link>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Related resources</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-300">
            {relatedLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      </MarketingArticleShell>
    </>
  );
}
