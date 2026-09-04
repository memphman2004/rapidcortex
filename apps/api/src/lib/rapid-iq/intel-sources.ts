import { randomBytes } from "node:crypto";
import type { RapidIqIntelSourceDocument, RapidIqIntelSourceType, RapidIqIntelWatch } from "rapid-cortex-shared";
import { extractLinks, fetchIngestText, parseRssOrAtomItems, stripHtml } from "./pipeline/ingest-fetch.js";
import { createJsonResponse } from "./openai-client.js";
import { isRapidIqWebSearchEnabled } from "./openai-config.js";

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
): Promise<RapidIqIntelSourceDocument[]> {
  const now = new Date().toISOString();
  const docs: RapidIqIntelSourceDocument[] = [];
  const seen = new Set<string>();

  const enqueue = (doc: RapidIqIntelSourceDocument) => {
    if (seen.has(doc.url) || docs.length >= limit) return;
    seen.add(doc.url);
    docs.push(doc);
  };

  for (const url of watch.sourceUrls) {
    if (docs.length >= limit) break;
    const fetched = await fetchIngestText(url);
    if (!fetched.ok || !fetched.body) continue;
    const text = stripHtml(fetched.body).slice(0, 20_000);
    const rss = looksLikeRss(url, "", fetched.body);
    if (rss) {
      const items = parseRssOrAtomItems(fetched.body).slice(0, 6);
      for (const item of items) {
        if (!keywordHit(`${item.title} ${item.description}`, watch.keywords)) continue;
        enqueue({
          sourceId: newSourceId(),
          agencyId: watch.id,
          url: item.link || url,
          title: item.title || watch.agency,
          text: stripHtml(item.description || item.title).slice(0, 12_000),
          publishedAt: item.pubDate || undefined,
          retrievedAt: now,
          sourceType: "rss",
          sourceName: watch.agency,
          metadata: { watchId: watch.id, agency: watch.agency },
        });
      }
      continue;
    }

    enqueue({
      sourceId: newSourceId(),
      agencyId: watch.id,
      url,
      title: watch.name,
      text,
      retrievedAt: now,
      sourceType: "web_page",
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
        sourceId: newSourceId(),
        agencyId: watch.id,
        url: link.href,
        title: link.text || watch.name,
        text: stripHtml(page.body).slice(0, 16_000),
        retrievedAt: now,
        sourceType: "web_page",
        sourceName: watch.agency,
        metadata: { watchId: watch.id, agency: watch.agency },
      });
    }
  }

  if (isRapidIqWebSearchEnabled() && docs.length < limit) {
    const extra = await discoverWatchUrlsViaWebSearch(watch, 3);
    for (const url of extra) {
      if (docs.length >= limit) break;
      const page = await fetchIngestText(url);
      if (!page.ok) continue;
      enqueue({
        sourceId: newSourceId(),
        agencyId: watch.id,
        url,
        title: watch.name,
        text: stripHtml(page.body).slice(0, 16_000),
        retrievedAt: now,
        sourceType: "openai_web_search",
        sourceName: watch.agency,
        metadata: { watchId: watch.id, agency: watch.agency },
      });
    }
  }

  return docs;
}

async function discoverWatchUrlsViaWebSearch(
  watch: RapidIqIntelWatch,
  limit: number,
): Promise<string[]> {
  const topics = watch.keywords.slice(0, 8).join(", ");
  const raw = await createJsonResponse({
    model: process.env.RAPIDIQ_MODEL_CLASSIFICATION?.trim() || "gpt-4o-mini",
    system:
      "Return JSON only. Find public procurement or board/budget URLs for the named transit agency.",
    jsonSchemaName: "rapid_iq_web_search_urls",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: { urls: { type: "array", items: { type: "string" } } },
      required: ["urls"],
    },
    user: JSON.stringify({
      agency: watch.agency,
      domains: watch.sourceDomains,
      topics,
    }),
    webSearch: true,
  });
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.text) as { urls?: unknown };
    const urls = Array.isArray(parsed.urls)
      ? parsed.urls.filter((u): u is string => typeof u === "string")
      : [];
    return urls
      .filter((u) => {
        try {
          const host = new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
          return (
            watch.sourceDomains.some((d) => host === d || host.endsWith(`.${d}`)) ||
            host.includes("sam.gov")
          );
        } catch {
          return false;
        }
      })
      .slice(0, limit);
  } catch {
    return [];
  }
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
