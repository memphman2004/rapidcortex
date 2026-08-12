import type { ClassifiedSignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { classifySignal } from "../../../lib/rapid-iq/claude-classifier.js";
import {
  buildRaceSignal,
  isRunSignUpConfigured,
  searchUpcomingRaces,
} from "../../../lib/rapid-iq/runsignup-client.js";
import {
  VENUE_NEWS_KEYWORDS,
  VENUE_NEWS_SOURCES,
} from "../../../lib/rapid-iq/venue-news-sources.js";
import { upsertSignalAndOpportunity } from "./upsert-signal.js";

const TARGET_STATES = [
  "GA",
  "AL",
  "FL",
  "SC",
  "TN",
  "NC",
  "VA",
  "TX",
  "OH",
  "PA",
  "IL",
  "CA",
  "NY",
  "WA",
  "CO",
  "AZ",
  "NV",
  "OR",
  "MI",
  "IN",
  "MO",
];

const DAYS_AHEAD_MIN = 30;
const DAYS_AHEAD_MAX = 120;
const MIN_PARTICIPANTS = 500;

const OCR_EVENTS = [
  {
    name: "Spartan Race",
    url: "https://www.spartan.com/en/race/find-race",
    agencyName: "Spartan Race Inc.",
  },
  {
    name: "Tough Mudder",
    url: "https://toughmudder.com/events",
    agencyName: "Tough Mudder LLC",
  },
  {
    name: "Warrior Dash",
    url: "https://www.warriordash.com/events",
    agencyName: "Warrior Dash Events",
  },
];

type RssArticle = {
  title: string;
  description: string;
  url: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagInner(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1] ? decodeXml(m[1]) : "";
}

async function fetchRssFeed(url: string): Promise<RssArticle[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn(JSON.stringify({ msg: "venue_rss_http_error", url, status: res.status }));
    return [];
  }
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((item) => {
      const title = tagInner(item, "title");
      const description = tagInner(item, "description") || tagInner(item, "summary");
      const link = tagInner(item, "link") || tagInner(item, "guid");
      if (!title || !link) return null;
      return { title, description, url: link };
    })
    .filter((a): a is RssArticle => Boolean(a));
}

function emptyClassified(partial: Partial<ClassifiedSignal> & Pick<ClassifiedSignal, "agencyName">): ClassifiedSignal {
  return {
    isRelevant: true,
    signalType: "news",
    agencyName: partial.agencyName,
    agencyType: partial.agencyType ?? "venue",
    city: partial.city ?? null,
    state: partial.state ?? null,
    county: null,
    population: null,
    aiHeadline: partial.aiHeadline ?? null,
    aiSummary: partial.aiSummary ?? null,
    excerpt: null,
    dollarValue: null,
    dollarValueContext: null,
    incumbentVendor: null,
    intentStage: partial.intentStage ?? "awareness",
    rcProduct: "venue",
    tags: partial.tags ?? ["OPPORTUNITY"],
    mentionedEntities: partial.mentionedEntities ?? [],
    scoreContrib: partial.scoreContrib ?? 10,
    confidence: "medium",
    vertical: "venue",
  };
}

export async function runVenueCollector(): Promise<{ signalsFound: number }> {
  let total = 0;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + DAYS_AHEAD_MIN);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + DAYS_AHEAD_MAX);

  // ── 1. Road races via RunSignUp ──────────────────────────────────────────
  if (!isRunSignUpConfigured()) {
    console.warn(
      JSON.stringify({
        msg: "venue_runsignup_skipped",
        reason: "RAPID_IQ_RUNSIGNUP_CREDENTIALS_SECRET_ARN not set",
      }),
    );
  } else {
    for (const state of TARGET_STATES) {
      try {
        await sleep(1000);
        const races = await searchUpcomingRaces(state, startDate, endDate, MIN_PARTICIPANTS);
        console.log(JSON.stringify({ msg: "runsignup_races_found", state, count: races.length }));

        for (const race of races) {
          const raceDate = new Date(race.next_date);
          const daysUntil = Number.isNaN(raceDate.getTime())
            ? DAYS_AHEAD_MAX
            : Math.floor((raceDate.getTime() - Date.now()) / 86_400_000);
          const rawText = buildRaceSignal(race, daysUntil);
          const sourceUrl = race.url || `https://runsignup.com/Race/${race.race_id}`;
          const signal = await classifySignal(rawText, sourceUrl, "RunSignUp");

          const result = await upsertSignalAndOpportunity(
            {
              ...signal,
              isRelevant: true,
              signalType: signal.signalType ?? "news",
              agencyName: race.name,
              agencyType: "road_race",
              city: race.address.city || signal.city,
              state: race.address.state || state,
              rcProduct: "venue",
              vertical: "venue",
              intentStage: daysUntil <= 60 ? "active_rfp" : "evaluation",
              scoreContrib: daysUntil <= 60 ? 20 : 12,
              tags: [
                "OPPORTUNITY",
                "ROAD RACE",
                ...(daysUntil <= 60 ? ["UPCOMING EVENT"] : []),
                ...(race.participant_cap && race.participant_cap >= 5000 ? ["LARGE EVENT"] : []),
              ],
              mentionedEntities: race.race_director
                ? [{ name: race.race_director.name, role: "Race Director" }]
                : signal.mentionedEntities,
            },
            sourceUrl,
            "RunSignUp",
            "api",
            `runsignup#${state}`,
          );
          if (result.saved) total++;
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "venue_runsignup_error",
            state,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  // ── 2. Obstacle course race event calendars ─────────────────────────────
  for (const ocr of OCR_EVENTS) {
    try {
      await sleep(2000);
      const result = await upsertSignalAndOpportunity(
        emptyClassified({
          agencyName: ocr.agencyName,
          agencyType: "obstacle_course_race",
          city: "National",
          state: "US",
          intentStage: "awareness",
          scoreContrib: 10,
          aiHeadline: `${ocr.name} operates 100+ events annually requiring real-time incident reporting`,
          aiSummary: `${ocr.name} is a national OCR company running large-scale outdoor events with thousands of participants. Each event requires medical coordination, incident reporting, and safety communications across remote terrain. Rapid Cortex Venue's QR incident reporting, camera integration, and operations dashboard directly addresses these needs at scale. A single corporate deal covers all their US events.`,
          tags: ["OPPORTUNITY", "OBSTACLE COURSE", "CORPORATE ACCOUNT"],
        }),
        ocr.url,
        ocr.name,
        "news",
        `ocr#${ocr.name.toLowerCase().replace(/\s+/g, "-")}`,
      );
      if (result.saved) total++;
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "venue_ocr_error",
          name: ocr.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  // ── 3. Venue industry news RSS ───────────────────────────────────────────
  for (const source of VENUE_NEWS_SOURCES) {
    try {
      await sleep(2000);
      const articles = await fetchRssFeed(source.url);
      const relevant = articles.filter((a) =>
        VENUE_NEWS_KEYWORDS.some((kw) => `${a.title} ${a.description}`.toLowerCase().includes(kw)),
      );

      for (const article of relevant.slice(0, 5)) {
        const signal = await classifySignal(
          `${article.title}\n${article.description}`,
          article.url,
          source.name,
        );
        if (!signal.isRelevant) continue;
        const result = await upsertSignalAndOpportunity(
          { ...signal, rcProduct: "venue", vertical: "venue" },
          article.url,
          source.name,
          "news",
          `venue_news#${source.name.toLowerCase().replace(/\s+/g, "-")}`,
        );
        if (result.saved) total++;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "venue_news_error",
          source: source.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(JSON.stringify({ msg: "venue_collector_complete", signalsFound: total }));
  return { signalsFound: total };
}
