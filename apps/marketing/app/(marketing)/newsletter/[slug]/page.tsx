import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  VERTICAL_COLORS,
  VERTICAL_LABELS,
  formatIssueMonth,
  getIssueBySlug,
  getNextIssue,
  getPublishedIssues,
  issueLabel,
} from "@/lib/newsletter/newsletter-data";
import { IssueDropdown } from "@/components/newsletter/IssueDropdown";
import { NextIssueBanner } from "@/components/newsletter/NextIssueBanner";
import { VerticalNewsSection } from "@/components/newsletter/VerticalNewsSection";
import { SubscribeForm } from "@/components/newsletter/SubscribeForm";

type PageParams = { slug: string };

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.nexcortiq.us";

export async function generateStaticParams() {
  return getPublishedIssues().map((issue) => ({ slug: issue.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const issue = getIssueBySlug(slug);
  if (!issue || issue.status !== "published") return {};
  const url = `${SITE_URL}/newsletter/${issue.slug}`;
  return {
    title: `${issue.title} | The NexCortiQ Signal`,
    description: issue.coverTagline ?? issue.subtitle,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: issue.title,
      description: issue.subtitle,
      url,
      publishedTime: issue.publishDate,
    },
  };
}

export default async function NewsletterEditionPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  const issue = getIssueBySlug(slug);
  if (!issue || issue.status !== "published") notFound();

  const next = getNextIssue();
  const upcoming = false;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: issue.title,
    description: issue.subtitle,
    datePublished: issue.publishDate,
    mainEntityOfPage: `${SITE_URL}/newsletter/${issue.slug}`,
    publisher: { "@type": "Organization", name: "NexCort iQ", url: SITE_URL },
  };

  return (
    <div className="min-h-screen" style={{ background: "#0A1628" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NextIssueBanner />

      <article className="px-6 py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <nav className="font-mono text-xs uppercase tracking-wider text-slate-500">
            <Link href="/newsletter" className="hover:text-slate-300">
              ← Newsletter
            </Link>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
            <span>
              Vol. {issue.volume}, No. {issue.issue}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={issue.publishDate}>{formatIssueMonth(issue.publishDate)}</time>
            {issue.isHolidayIssue ? (
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">❄ Holiday</span>
            ) : null}
            {upcoming ? (
              <span className="rounded bg-slate-700/50 px-2 py-0.5 text-slate-300">Coming Soon</span>
            ) : null}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {issue.title}
          </h1>
          <p className="mt-2 text-lg text-slate-400">{issue.subtitle}</p>

          <ul className="mt-4 flex flex-wrap gap-1.5">
            {issue.featuredVerticals.map((v) => (
              <li
                key={v}
                className="rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white"
                style={{ background: VERTICAL_COLORS[v] }}
              >
                {VERTICAL_LABELS[v]}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <IssueDropdown currentSlug={issue.slug} />
          </div>

          {upcoming ? (
            <div className="mt-10 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-6">
              <p className="text-slate-300">
                This edition publishes{" "}
                <strong className="text-white">{formatIssueMonth(issue.publishDate)}</strong>. Full
                content will appear here — no subscription required.
              </p>
              {issue.coverTagline ? (
                <p className="mt-3 text-sm italic text-slate-400">{issue.coverTagline}</p>
              ) : null}
              {next && next.slug === issue.slug ? null : null}
            </div>
          ) : (
            <div className="mt-10 space-y-10 border-t border-slate-800 pt-10">
              {issue.coverTagline ? (
                <p className="text-lg italic text-slate-300">{issue.coverTagline}</p>
              ) : null}

              <section>
                <h2 className="text-xl font-semibold text-white">Feature Spotlight</h2>
                <p className="mt-3 leading-relaxed text-slate-300">{issue.featureSpotlight}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-white">In the News</h2>
                <p
                  className="mt-3 border-l-4 pl-4 leading-relaxed text-slate-300"
                  style={{ borderLeftColor: "#C62828" }}
                >
                  {issue.primaryInTheNews}
                </p>
              </section>

              <VerticalNewsSection news={issue.verticalNews} />

              <section>
                <h2 className="text-xl font-semibold text-white">Funding Focus</h2>
                <p className="mt-3 leading-relaxed text-slate-300">{issue.fundingFocus}</p>
                <Link
                  href="/grants"
                  className="mt-3 inline-flex text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  Explore Grant Success Program →
                </Link>
              </section>

              <div className="flex flex-wrap gap-3">
                {issue.pdfUrl ? (
                  <a
                    href={issue.pdfUrl}
                    className="inline-flex items-center rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-sky-500/50"
                  >
                    Download PDF ↓
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-500">
                    PDF coming soon
                  </span>
                )}
                <Link
                  href="/demo"
                  className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Request a demo
                </Link>
                <Link
                  href="/free-60-day-pilot"
                  className="inline-flex items-center text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  Free 60-day pilot →
                </Link>
              </div>
            </div>
          )}

          <div className="mt-12">
            <SubscribeForm compact />
          </div>

          <p className="mt-8 font-mono text-[11px] uppercase tracking-wider text-slate-600">
            {issueLabel(issue)}
          </p>
        </div>
      </article>
    </div>
  );
}
