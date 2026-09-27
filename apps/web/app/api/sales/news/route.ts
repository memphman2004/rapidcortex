import { NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";

export const revalidate = 900;

export type NewsVertical =
  | "911"
  | "campus"
  | "venue"
  | "transit"
  | "law-enforcement"
  | "fire-ems"
  | "govtech"
  | "general";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  vertical: NewsVertical;
  publishedAt: string;
  summary: string;
};

/**
 * Reputable public-safety / first-responder / campus RSS sources for the sales News tab.
 * Feed URLs verified reachable; sites without a public RSS are omitted (e.g. CrimeWatch, Clery Center HTML).
 * Curated source hubs (NIST public-safety, StateTech, APTA, FTA) are linked via `sourceUrl`.
 */
const FEEDS = [
  {
    source: "Police1",
    sourceUrl: "https://www.policeone.com",
    feedUrl: "https://www.policeone.com/news/rss.xml",
    vertical: "law-enforcement" as const,
  },
  {
    source: "IACP",
    sourceUrl: "https://www.theiacp.org",
    feedUrl: "https://www.theiacp.org/rss.xml",
    vertical: "law-enforcement" as const,
  },
  {
    source: "Lexipol — Public Safety",
    sourceUrl: "https://www.lexipol.com/category/public-safety/",
    feedUrl: "https://www.lexipol.com/category/public-safety/feed/",
    vertical: "law-enforcement" as const,
  },
  {
    source: "IAFC",
    sourceUrl: "https://www.iafc.org",
    feedUrl: "https://www.iafc.org/rss",
    vertical: "fire-ems" as const,
  },
  {
    source: "EMS World",
    sourceUrl: "https://www.hmpgloballearningnetwork.com/site/emsworld",
    feedUrl: "https://www.hmpgloballearningnetwork.com/site/emsworld/rss.xml",
    vertical: "fire-ems" as const,
  },
  {
    source: "FirstNet Authority",
    sourceUrl: "https://www.firstnet.gov",
    feedUrl: "https://www.firstnet.gov/rss.xml",
    vertical: "911" as const,
  },
  {
    source: "RapidSOS Blog",
    sourceUrl: "https://rapidsos.com/blog",
    feedUrl: "https://rapidsos.com/blog/feed/",
    vertical: "911" as const,
  },
  {
    source: "Government Technology — Public Safety",
    sourceUrl: "https://www.govtech.com/em/safety",
    feedUrl: "https://www.govtech.com/em/safety.rss",
    vertical: "govtech" as const,
  },
  {
    source: "StateTech Magazine",
    sourceUrl: "https://statetechmagazine.com/public-safety",
    feedUrl: "https://statetechmagazine.com/rss.xml",
    vertical: "govtech" as const,
  },
  {
    source: "NIST News",
    sourceUrl: "https://www.nist.gov/public-safety",
    feedUrl: "https://www.nist.gov/news-events/news/rss.xml",
    vertical: "general" as const,
  },
  {
    source: "CISA News",
    sourceUrl: "https://www.cisa.gov",
    feedUrl: "https://www.cisa.gov/news.xml",
    vertical: "general" as const,
  },
  {
    source: "School Safety.gov",
    sourceUrl: "https://www.schoolsafety.gov",
    feedUrl: "https://www.schoolsafety.gov/rss.xml",
    vertical: "campus" as const,
  },
  {
    source: "Campus Resilience & Security",
    sourceUrl: "https://campusresiliencesecurity.com",
    feedUrl: "https://campusresiliencesecurity.com/feed",
    vertical: "campus" as const,
  },
  {
    source: "AMU Edge — Public Safety",
    sourceUrl: "https://amuedge.com/category/public-safety/",
    feedUrl: "https://amuedge.com/category/public-safety/feed/",
    vertical: "campus" as const,
  },
  {
    source: "RAND — Public Safety",
    sourceUrl: "https://www.rand.org/topics/public-safety.html",
    feedUrl: "https://www.rand.org/topics/public-safety.xml",
    vertical: "general" as const,
  },
] as const;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(
  xml: string,
  meta: (typeof FEEDS)[number],
): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const entryBlocks = blocks.length ? blocks : xml.split(/<entry[\s>]/i).slice(1);
  for (const block of entryBlocks.slice(0, 12)) {
    const title = stripHtml(
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    );
    const link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
      stripHtml(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const pub =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1] ??
      "";
    const summary = stripHtml(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ??
        "",
    );
    if (!title || !link) continue;
    const publishedAt = pub ? new Date(stripHtml(pub)).toISOString() : "";
    items.push({
      id: `${meta.source}:${link}`.slice(0, 200),
      title,
      url: link.trim(),
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      vertical: meta.vertical,
      publishedAt: Number.isNaN(Date.parse(publishedAt)) ? "" : publishedAt,
      summary: summary.slice(0, 400),
    });
  }
  return items;
}

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.feedUrl, {
          signal: AbortSignal.timeout(8000),
          headers: {
            Accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            "User-Agent":
              "Mozilla/5.0 (compatible; NexCortIQ-SalesNews/1.0; +https://nexcortiq.us)",
          },
          next: { revalidate: 900 },
        });
        if (!res.ok) return [] as NewsItem[];
        const xml = await res.text();
        return parseRssItems(xml, feed);
      } catch {
        return [] as NewsItem[];
      }
    }),
  );

  const items = results
    .flat()
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 100);

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}
