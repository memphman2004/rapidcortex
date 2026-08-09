import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { textMatchesUniversityTerms } from "../../../lib/rapid-iq/university-search-terms.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const SOURCES = [
  {
    name: "Chronicle of Higher Education",
    url: "https://www.chronicle.com/search?q=campus+safety+technology",
    type: "news",
  },
  {
    name: "Campus Safety Magazine",
    url: "https://www.campussafetymagazine.com/tag/technology",
    type: "trade_publication",
  },
  {
    name: "IACLEA",
    url: "https://www.iaclea.org/resources",
    type: "association",
  },
  {
    name: "Inside Higher Ed — Safety",
    url: "https://www.insidehighered.com/news/campus-safety",
    type: "news",
  },
] as const;

type NewsArticle = {
  url: string;
  title: string;
  text: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRecentArticles(sourceUrl: string, sourceName: string): Promise<NewsArticle[]> {
  if (isCollectorsMockEnabled()) {
    return [
      {
        url: `${sourceUrl}#mock-campus-safety`,
        title: `${sourceName}: Campus safety technology modernization`,
        text: [
          "Campus safety software RFP and Clery Act compliance technology",
          "University police budget increase for campus emergency notification",
          "Higher education public safety modernization — Rapid Cortex Campus fit",
          `Source: ${sourceName}`,
        ].join(". "),
      },
    ];
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map((m) => m[1] ?? "")
      .filter((h) => h.startsWith("http") || h.startsWith("/"))
      .slice(0, 20);

    const origin = new URL(sourceUrl).origin;
    const articles: NewsArticle[] = [];
    for (const href of hrefs) {
      const absolute = href.startsWith("http") ? href : new URL(href, origin).toString();
      if (!textMatchesUniversityTerms(absolute) && !textMatchesUniversityTerms(html.slice(0, 2000))) {
        continue;
      }
      articles.push({
        url: absolute,
        title: absolute,
        text: `Campus safety / higher education article from ${sourceName}. URL: ${absolute}. ${html.slice(0, 1500)}`,
      });
      if (articles.length >= 10) break;
    }
    return articles;
  } catch {
    return [];
  }
}

export async function runUniversityNewsCollector(): Promise<{ signalsFound: number }> {
  let total = 0;

  for (const source of SOURCES) {
    try {
      await sleep(isCollectorsMockEnabled() ? 10 : 2000);
      const articles = await fetchRecentArticles(source.url, source.name);

      for (const article of articles.slice(0, 10)) {
        const signal = await classifySignal(article.text, article.url, source.name);
        const isCampus =
          signal.rcProduct === "campus" ||
          signal.vertical === "campus" ||
          textMatchesUniversityTerms(article.text);

        if (!signal.isRelevant || !isCampus) continue;

        signal.vertical = "campus";
        signal.rcProduct = "campus";
        signal.agencyType = signal.agencyType ?? "university";
        signal.tags = Array.from(new Set(["CAMPUS SAFETY", "OPPORTUNITY", ...(signal.tags ?? [])]));

        await upsertSignalAndOpportunity(
          signal,
          article.url,
          signal.agencyName ?? source.name,
          source.type,
          "university_news#US",
        );
        total++;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "university_news_collector_error",
          source: source.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(
    JSON.stringify({ msg: "university_news_collector_complete", signalsFound: total }),
  );
  return { signalsFound: total };
}
