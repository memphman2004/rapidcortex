/**
 * Polite HTML/RSS fetch helpers for Rapid IQ public-page crawlers.
 */

export const RAPID_IQ_INGEST_UA = "RapidCortex-IQ/1.0 (public-safety-signals)";

export async function fetchIngestText(
  url: string,
  timeoutMs = 20_000,
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": RAPID_IQ_INGEST_UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_ingest_fetch_failed",
        url,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { ok: false, status: 0, body: "" };
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function extractLinks(
  html: string,
  baseUrl: string,
): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const rawHref = (match[1] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.toLowerCase().startsWith("javascript:")) {
      continue;
    }
    let href = rawHref;
    try {
      href = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }
    const text = stripHtml(match[2] ?? "").slice(0, 300);
    if (!text) continue;
    links.push({ href, text });
  }
  return links;
}

export type IngestRssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
};

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const match = xml.match(re);
  return (match?.[1] ?? "").trim();
}

export function parseRssOrAtomItems(xml: string): IngestRssItem[] {
  const items: IngestRssItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1] ?? "";
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: stripHtml(extractTag(block, "description")).slice(0, 1500),
      pubDate: extractTag(block, "pubDate"),
      guid: extractTag(block, "guid") || link,
    });
  }
  if (items.length > 0) return items;

  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const block = match[1] ?? "";
    const title = extractTag(block, "title");
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const link = linkMatch?.[1] ?? extractTag(block, "id");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: stripHtml(extractTag(block, "summary") || extractTag(block, "content")).slice(0, 1500),
      pubDate: extractTag(block, "updated") || extractTag(block, "published"),
      guid: extractTag(block, "id") || link,
    });
  }
  return items;
}

export function parseIsoDate(value: string | undefined, fallback = new Date()): string {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return fallback.toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
