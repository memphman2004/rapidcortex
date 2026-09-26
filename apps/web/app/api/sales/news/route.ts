import { NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";

export const revalidate = 900;

export type NewsVertical =
  | "911"
  | "campus"
  | "venue"
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

const FEEDS = [
  {
    source: "Urgent Communications",
    sourceUrl: "https://urgentcomm.com",
    feedUrl: "https://urgentcomm.com/feed/",
    vertical: "911" as const,
  },
  {
    source: "Government Technology",
    sourceUrl: "https://www.govtech.com",
    feedUrl: "https://www.govtech.com/rss.xml",
    vertical: "govtech" as const,
  },
  {
    source: "PoliceOne",
    sourceUrl: "https://www.policeone.com",
    feedUrl: "https://www.policeone.com/rss/police-news/",
    vertical: "law-enforcement" as const,
  },
  {
    source: "FireRescue1",
    sourceUrl: "https://www.firerescue1.com",
    feedUrl: "https://www.firerescue1.com/rss/fr1-news/",
    vertical: "fire-ems" as const,
  },
  {
    source: "EMS1",
    sourceUrl: "https://www.ems1.com",
    feedUrl: "https://www.ems1.com/rss/ems1-news/",
    vertical: "fire-ems" as const,
  },
  {
    source: "Campus Safety Magazine",
    sourceUrl: "https://www.campussafetymagazine.com",
    feedUrl: "https://www.campussafetymagazine.com/rss/",
    vertical: "campus" as const,
  },
  {
    source: "Security Magazine",
    sourceUrl: "https://www.securitymagazine.com",
    feedUrl: "https://www.securitymagazine.com/rss/all",
    vertical: "general" as const,
  },
  {
    source: "Domestic Preparedness",
    sourceUrl: "https://domesticpreparedness.com",
    feedUrl: "https://domesticpreparedness.com/feed/",
    vertical: "general" as const,
  },
  {
    source: "Emergency Management",
    sourceUrl: "https://www.emergencymgmt.com",
    feedUrl: "https://www.emergencymgmt.com/rss.xml",
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
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "NexCortIQ-SalesNews/1.0" },
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
    .slice(0, 80);

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}
