/**
 * News RSS ingestion — GovTech, Route Fifty, Tyler press, APCO, NENA.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isRelevantSignalText } from "rapid-cortex-shared";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

const RSS_SOURCES: Array<{ id: string; url: string; label: string }> = [
  { id: "govtech", url: "https://www.govtech.com/rss", label: "Government Technology" },
  { id: "route-fifty", url: "https://www.route-fifty.com/rss/all", label: "Route Fifty" },
  {
    id: "tyler-press",
    url: "https://www.prnewswire.com/rss/computer-electronics/tyler-technologies-inc-list.rss",
    label: "Tyler Technologies Press",
  },
  {
    id: "motorola-news",
    url: "https://newsroom.motorolasolutions.com/rss",
    label: "Motorola Solutions Newsroom",
  },
  { id: "apco-news", url: "https://www.apcointl.org/feed/", label: "APCO International" },
];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const match = xml.match(re);
  return (match?.[1] ?? "").trim();
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1] ?? "";
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: extractTag(block, "description")
        .replace(/<[^>]+>/g, "")
        .slice(0, 1500),
      pubDate: extractTag(block, "pubDate"),
      guid: extractTag(block, "guid") || extractTag(block, "link"),
    });
  }
  return items;
}

function isRelevant(item: RssItem): boolean {
  return isRelevantSignalText(`${item.title} ${item.description}`);
}

function parseDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* fall through */
  }
  return new Date().toISOString().slice(0, 10);
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: News RSS ingestion starting");

  if (await enqueueMockIfEnabled("news-rss")) {
    console.log("Rapid IQ pipeline: News RSS mock path complete");
    return;
  }

  for (const source of RSS_SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; RapidCortex-IQ/1.0; +https://rapidcortex.us)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.warn(`RSS fetch failed for ${source.id}: ${res.status}`);
        continue;
      }

      const xml = await res.text();
      const items = parseRssItems(xml);
      const relevant = items.filter(isRelevant);

      console.log(`${source.id}: ${items.length} items → ${relevant.length} relevant`);

      for (const item of relevant) {
        const signal: RapidIqPipelineRawSignal = {
          sourceId: "news-rss",
          sourceUrl: item.link,
          rawTitle: `[${source.label}] ${item.title}`.slice(0, 200),
          rawSnippet: `Title: ${item.title}\n\nSource: ${source.label}\nURL: ${item.link}\n\n${item.description}`,
          signalDate: parseDate(item.pubDate),
        };
        await enqueueRawSignal(signal, {
          dedupeId: `news-rss-${source.id}-${item.guid || item.link}`,
        });
      }
    } catch (err) {
      console.error(`RSS ingestion failed for ${source.id}:`, err);
    }
  }

  console.log("Rapid IQ pipeline: News RSS ingestion complete");
}
