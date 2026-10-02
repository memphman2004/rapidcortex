import * as cheerio from "cheerio";

export type HeadingLevel = "h1" | "h2" | "h3";

export type PageAnalysis = {
  title: string;
  metaDescription: string;
  metaRobots: string;
  canonicalHref: string;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  h1: string[];
  h2: string[];
  h3: string[];
  internalLinks: string[];
  externalLinks: string[];
  imagesMissingAlt: number;
  imagesTotal: number;
  wordCount: number;
  bodyText: string;
  schemaTypes: string[];
  jsonLdRawCount: number;
  viewportPresent: boolean;
  charsetMeta: boolean;
};

function textWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Parses sanitized HTML and extracts SEO signals (no script execution). */
export function analyzeHtml(html: string, pageUrl: string): PageAnalysis {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const origin = new URL(pageUrl).origin;

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    "";
  const metaRobots = $('meta[name="robots"]').attr("content")?.trim() ?? "";
  const canonicalHref = $('link[rel="canonical"]').attr("href")?.trim() ?? "";

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property")?.trim();
    const content = $(el).attr("content")?.trim();
    if (prop && content) openGraph[prop] = content;
  });

  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name")?.trim();
    const content = $(el).attr("content")?.trim();
    if (name && content) twitter[name] = content;
  });

  const h1: string[] = [];
  $("h1").each((_, el) => {
    const t = $(el).text().trim();
    if (t) h1.push(t);
  });
  const h2: string[] = [];
  $("h2").each((_, el) => {
    const t = $(el).text().trim();
    if (t) h2.push(t);
  });
  const h3: string[] = [];
  $("h3").each((_, el) => {
    const t = $(el).text().trim();
    if (t) h3.push(t);
  });

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const raw = ($(el).attr("href") ?? "").trim();
    if (!raw || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) return;
    try {
      const abs = new URL(raw, pageUrl).href;
      const o = new URL(abs).origin;
      if (o === origin) internalLinks.push(abs);
      else externalLinks.push(abs);
    } catch {
      /* skip malformed */
    }
  });

  let imagesMissingAlt = 0;
  let imagesTotal = 0;
  $("img").each((_, el) => {
    imagesTotal += 1;
    const alt = ($(el).attr("alt") ?? "").trim();
    if (!alt) imagesMissingAlt += 1;
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = textWords(bodyText);

  const schemaTypes: string[] = [];
  let jsonLdRawCount = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    jsonLdRawCount += 1;
    const raw = $(el).contents().text();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        const o = cur as Record<string, unknown>;
        const t = o["@type"];
        if (typeof t === "string") schemaTypes.push(t);
        if (Array.isArray(t)) {
          for (const x of t) if (typeof x === "string") schemaTypes.push(x);
        }
        for (const v of Object.values(o)) {
          if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  });

  const viewportPresent = $('meta[name="viewport"]').length > 0;
  const charsetMeta = $('meta[charset]').length > 0 || $('meta[http-equiv="Content-Type"]').length > 0;

  return {
    title,
    metaDescription,
    metaRobots,
    canonicalHref,
    openGraph,
    twitter,
    h1,
    h2,
    h3,
    internalLinks,
    externalLinks,
    imagesMissingAlt,
    imagesTotal,
    wordCount,
    bodyText,
    schemaTypes,
    jsonLdRawCount,
    viewportPresent,
    charsetMeta,
  };
}
