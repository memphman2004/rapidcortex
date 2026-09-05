import { randomBytes } from "node:crypto";
import type { RapidIqIntelSourceDocument, RapidIqIntelSourceType, RapidIqIntelWatch } from "rapid-cortex-shared";
import { extractLinks, fetchIngestText, parseRssOrAtomItems, stripHtml } from "./pipeline/ingest-fetch.js";

function newSourceId(): string {
  return `isrc_${randomBytes(6).toString("hex")}`;
}

function looksLikeRss(url: string, contentTypeHint: string, body: string): boolean {
  if (/\.rss($|\?)|\/rss|\/feed/i.test(url)) return true;
  if (/rss|xml|atom/i.test(contentTypeHint)) return true;
  return /<rss[\s>]|<feed[\s>]/i.test(body.slice(0, 500));
}

function keywordHit(text: string, keywords: string[]): boolean {
  const hay = text.toLowerCase();
  return keywords.some((k) => k.trim() && hay.includes(k.toLowerCase()));
}

export async function collectWatchSourceDocuments(
  watch: RapidIqIntelWatch,
  limit = 8,
  extraUrls: Array<{ url: string; sourceType: RapidIqIntelSourceType }> = [],
): Promise<RapidIqIntelSourceDocument[]> {
  const now = new Date().toISOString();
  const docs: RapidIqIntelSourceDocument[] = [];
  const seen = new Set<string>();

  const enqueue = (doc: RapidIqIntelSourceDocument) => {
    if (seen.has(doc.url) || docs.length >= limit) return;
    seen.add(doc.url);
    docs.push(doc);
  };

  const fetchPage = async (
    url: string,
    sourceType: RapidIqIntelSourceType,
    titleHint: string,
  ) => {
    if (docs.length >= limit) return;
    const sourceId = sourceType === "openai_web_search" ? "openai-web-search" : newSourceId();
    const fetched = await fetchIngestText(url);
    if (!fetched.ok || !fetched.body) return;
    const text = stripHtml(fetched.body).slice(0, 20_000);
    const rss = looksLikeRss(url, "", fetched.body);
    if (rss) {
      const items = parseRssOrAtomItems(fetched.body).slice(0, 6);
      for (const item of items) {
        if (!keywordHit(`${item.title} ${item.description}`, watch.keywords)) continue;
        enqueue({
          sourceId,
          agencyId: watch.id,
          url: item.link || url,
          title: item.title || watch.agency,
          text: stripHtml(item.description || item.title).slice(0, 12_000),
          publishedAt: item.pubDate || undefined,
          retrievedAt: now,
          sourceType: sourceType === "openai_web_search" ? "openai_web_search" : "rss",
          sourceName: watch.agency,
          metadata: { watchId: watch.id, agency: watch.agency },
        });
      }
      return;
    }

    enqueue({
      sourceId,
      agencyId: watch.id,
      url,
      title: titleHint,
      text,
      retrievedAt: now,
      sourceType,
      sourceName: watch.agency,
      metadata: { watchId: watch.id, agency: watch.agency },
    });

    const links = extractLinks(fetched.body, url)
      .filter((l) => keywordHit(`${l.text} ${l.href}`, watch.keywords))
      .slice(0, 5);
    for (const link of links) {
      if (docs.length >= limit) break;
      const page = await fetchIngestText(link.href);
      if (!page.ok) continue;
      enqueue({
        sourceId: sourceType === "openai_web_search" ? "openai-web-search" : newSourceId(),
        agencyId: watch.id,
        url: link.href,
        title: link.text || watch.name,
        text: stripHtml(page.body).slice(0, 16_000),
        retrievedAt: now,
        sourceType: sourceType === "openai_web_search" ? "openai_web_search" : "web_page",
        sourceName: watch.agency,
        metadata: { watchId: watch.id, agency: watch.agency },
      });
    }
  };

  for (const url of watch.sourceUrls) {
    if (docs.length >= limit) break;
    await fetchPage(url, "web_page", watch.name);
  }

  for (const extra of extraUrls) {
    if (docs.length >= limit) break;
    await fetchPage(extra.url, extra.sourceType, watch.name);
  }

  return docs;
}

export function mockWatchDocuments(watch: RapidIqIntelWatch): RapidIqIntelSourceDocument[] {
  const now = new Date().toISOString();
  return [
    {
      sourceId: newSourceId(),
      agencyId: watch.id,
      url: watch.sourceUrls[0] ?? `https://example.invalid/${watch.id}`,
      title: `${watch.agency} board agenda — public safety communications`,
      text: [
        `${watch.agency} board discussion of public safety communications modernization,`,
        "transit police CAD interoperability, operations-center situational awareness,",
        "and rider incident reporting. Budget discussion; no active RFP posted.",
      ].join(" "),
      publishedAt: now.slice(0, 10),
      retrievedAt: now,
      sourceType: "web_page",
      sourceName: watch.agency,
      metadata: { watchId: watch.id, agency: watch.agency, mock: true },
    },
  ];
}

export function sourceDocumentFromManual(input: {
  url: string;
  title: string;
  text: string;
  agency?: string;
  watchId?: string;
  sourceType?: RapidIqIntelSourceType;
}): RapidIqIntelSourceDocument {
  return {
    sourceId: newSourceId(),
    agencyId: input.watchId,
    url: input.url,
    title: input.title,
    text: input.text,
    retrievedAt: new Date().toISOString(),
    sourceType: input.sourceType ?? "manual_url",
    sourceName: input.agency,
    metadata: { agency: input.agency, watchId: input.watchId },
  };
}
