/**
 * Latest public blog article for the weekly email draft.
 * Reads https://www.nexcortiq.us/blog — the same page the marketing site shows.
 */

const BLOG_RSS_URL = "https://www.nexcortiq.us/blog/rss.xml";

export type BlogArticle = {
  title: string;
  url: string;
  text: string;
};

/** User-facing sales copy must not use the old product name. */
export function scrubSalesBrand(text: string): string {
  return text
    .replace(/https?:\/\/(?:www\.)?rapidcortex\.us\b/gi, "https://www.nexcortiq.us")
    .replace(/\brapidcortex\.us\b/gi, "nexcortiq.us")
    .replace(/inside the cortex/gi, "Inside iQ")
    .replace(/rapid[\s-]*cortex/gi, "NexCort iQ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_m, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Pull the article body out of a rendered blog page. */
export function htmlToArticleText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const blocks: string[] = [];
  const re = /<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let seenTitle = false;
  while ((match = re.exec(cleaned))) {
    const tag = match[1].toLowerCase();
    const text = stripTags(match[2]);
    if (!text) continue;
    if (/^related\b/i.test(text) || /^field notes\b/i.test(text)) break;
    if (tag === "p" && text.length < 40) continue;
    if (tag === "h1") {
      if (seenTitle) break;
      seenTitle = true;
    }
    if (blocks[blocks.length - 1] === text) continue;
    blocks.push(text);
    if (blocks.length >= 80) break;
  }
  return blocks.join("\n\n").trim();
}

export function latestRssItem(xml: string): { title: string; url: string } | null {
  const item = xml.match(/<item>([\s\S]*?)<\/item>/i)?.[1];
  if (!item) return null;
  const title = stripTags(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const url = stripTags(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
  if (!title || !url.startsWith("https://www.nexcortiq.us/blog/")) return null;
  return { title, url };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "NexCort-iQ-newsletter/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Blog fetch failed (${res.status})`);
  return res.text();
}

export async function fetchLatestBlogArticle(): Promise<BlogArticle | null> {
  try {
    const rss = await fetchText(BLOG_RSS_URL);
    const item = latestRssItem(rss);
    if (!item) return null;
    const html = await fetchText(item.url);
    const text = scrubSalesBrand(htmlToArticleText(html));
    if (text.length < 200) return null;
    return { title: scrubSalesBrand(item.title), url: item.url, text };
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "nexcort_blog_article_fetch_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}
