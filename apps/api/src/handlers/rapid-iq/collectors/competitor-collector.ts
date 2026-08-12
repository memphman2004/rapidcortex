import type { ClassifiedSignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import {
  COMPETITOR_REGISTRY,
  rcProductForCompetitor,
  verticalForCompetitor,
  type Competitor,
} from "../../../lib/rapid-iq/competitor-registry.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const DISPLACEMENT_TRIGGERS = [
  "outage",
  "down",
  "breach",
  "lawsuit",
  "settlement",
  "price increase",
  "acquisition",
  "acquired",
  "merger",
  "end of life",
  "sunset",
  "discontinue",
  "contract expires",
  "replacing",
  "alternative to",
  "migration from",
  "unhappy with",
  "switching from",
  "moving away from",
];

const M_AND_A_TRIGGERS = [
  "acquired",
  "acquisition",
  "merger",
  "purchase",
  "buyout",
  "investment",
  "funding round",
  "raised",
  "ipo",
];

type GdeltArticle = {
  title: string;
  url: string;
  domain: string;
  seendate: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseArticles(data: unknown): GdeltArticle[] {
  const root = asRecord(data);
  const raw = Array.isArray(root?.articles) ? root.articles : [];
  return raw
    .map((item) => {
      const a = asRecord(item);
      if (!a) return null;
      const title = typeof a.title === "string" ? a.title.trim() : "";
      const url = typeof a.url === "string" ? a.url.trim() : "";
      if (!title || !url) return null;
      return {
        title,
        url,
        domain: typeof a.domain === "string" ? a.domain : "",
        seendate: typeof a.seendate === "string" ? a.seendate : "",
      };
    })
    .filter((a): a is GdeltArticle => Boolean(a));
}

function emptyCompetitorSignal(
  competitor: Competitor,
  article: GdeltArticle,
  isMandA: boolean,
  classified: ClassifiedSignal,
): ClassifiedSignal {
  const verticalTags = competitor.verticals
    .filter((v): v is "911" | "campus" | "venue" => v === "911" || v === "campus" || v === "venue")
    .map((v) => v.toUpperCase());

  return {
    isRelevant: true,
    signalType: "competitor",
    agencyName: `${competitor.name} — Competitor Signal`,
    agencyType: "competitor_watch",
    city: "National",
    state: "US",
    county: null,
    population: null,
    aiHeadline: classified.aiHeadline ?? `${competitor.name}: ${article.title}`,
    aiSummary:
      classified.aiSummary ??
      `${competitor.name} news creates potential displacement opportunity. ${competitor.displacementNotes}`,
    excerpt: article.title,
    dollarValue: null,
    dollarValueContext: null,
    incumbentVendor: competitor.name,
    intentStage: "awareness",
    rcProduct: rcProductForCompetitor(competitor),
    tags: [
      "COMPETITOR",
      isMandA ? "M&A SIGNAL" : "DISPLACEMENT",
      ...verticalTags,
    ],
    mentionedEntities: [{ name: competitor.name, role: "Competitor" }],
    scoreContrib: isMandA ? 25 : 15,
    confidence: "medium",
    vertical: verticalForCompetitor(competitor),
  };
}

export async function runCompetitorCollector(): Promise<{ signalsFound: number }> {
  let total = 0;

  for (const competitor of COMPETITOR_REGISTRY) {
    if (competitor.urgencyLevel === "low") continue;

    try {
      await sleep(1000);

      const gdeltUrl = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      gdeltUrl.searchParams.set(
        "query",
        `"${competitor.name}" (${DISPLACEMENT_TRIGGERS.slice(0, 5).join(" OR ")})`,
      );
      gdeltUrl.searchParams.set("mode", "artlist");
      gdeltUrl.searchParams.set("maxrecords", "5");
      gdeltUrl.searchParams.set("format", "json");
      gdeltUrl.searchParams.set("timespan", "1week");

      const res = await fetch(gdeltUrl.toString(), {
        headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.warn(
          JSON.stringify({
            msg: "competitor_gdelt_http_error",
            competitor: competitor.name,
            status: res.status,
          }),
        );
        continue;
      }

      const articles = parseArticles(await res.json());

      for (const article of articles) {
        const text = `${article.title}\n${article.seendate}\n${article.url}`;
        const lower = text.toLowerCase();
        const isDisplacementSignal = DISPLACEMENT_TRIGGERS.some((t) => lower.includes(t));
        const isMandASignal = M_AND_A_TRIGGERS.some((t) => lower.includes(t));
        if (!isDisplacementSignal && !isMandASignal) continue;

        const classified = await classifySignal(
          [
            "COMPETITOR INTELLIGENCE ALERT",
            `Competitor: ${competitor.name}`,
            `Verticals: ${competitor.verticals.join(", ")}`,
            `Article: ${article.title}`,
            `Source: ${article.domain}`,
            `Date: ${article.seendate}`,
            "",
            `Context: ${competitor.displacementNotes}`,
            `RC advantages: ${competitor.rcAdvantages.join("; ")}`,
          ].join("\n"),
          article.url,
          `Competitor Watch — ${competitor.name}`,
        );

        const result = await upsertSignalAndOpportunity(
          emptyCompetitorSignal(competitor, article, isMandASignal, classified),
          article.url,
          `Competitor Watch — ${competitor.name}`,
          "news",
          `competitor#${competitor.id}`,
        );
        // High-urgency M&A → Teams via upsert when opportunityScore ≥ 85 (scoreContrib 25).
        if (result.saved) total++;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "competitor_collector_error",
          competitor: competitor.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(JSON.stringify({ msg: "competitor_collector_complete", signalsFound: total }));
  return { signalsFound: total };
}
