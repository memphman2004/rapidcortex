import { env } from "../../lib/env.js";
import { assertPublicUrlLiterals, assertSafeFetchUrl } from "./ssrfGuard.js";

export type SitemapRobotsReport = {
  origin: string;
  scannedAt: string;
  sitemapUrl: string;
  sitemapOk: boolean;
  sitemapUrlCount: number;
  sitemapSampleUrls: string[];
  robotsUrl: string;
  robotsOk: boolean;
  robotsBodySnippet: string;
  disallowsAdminPaths: boolean;
};

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc[^>]*>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const u = m[1]?.trim();
    if (u) locs.push(u);
  }
  return locs;
}

export async function checkSitemapAndRobots(originInput: string): Promise<SitemapRobotsReport> {
  const safe = await assertSafeFetchUrl(originInput);
  const origin = safe.origin;
  const scannedAt = new Date().toISOString();

  const sitemapUrl = new URL("/sitemap.xml", origin).href;
  const robotsUrl = new URL("/robots.txt", origin).href;

  let sitemapOk = false;
  let sitemapUrlCount = 0;
  let sitemapSampleUrls: string[] = [];
  try {
    assertPublicUrlLiterals(sitemapUrl);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), env.seoFetchTimeoutMs);
    const res = await fetch(sitemapUrl, { signal: ac.signal, redirect: "follow" });
    clearTimeout(t);
    if (res.ok) {
      const text = await res.text();
      const locs = extractLocs(text);
      sitemapOk = locs.length > 0;
      sitemapUrlCount = locs.length;
      sitemapSampleUrls = locs.slice(0, 15);
    }
  } catch {
    sitemapOk = false;
  }

  let robotsOk = false;
  let robotsBodySnippet = "";
  try {
    assertPublicUrlLiterals(robotsUrl);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), Math.min(8000, env.seoFetchTimeoutMs));
    const res = await fetch(robotsUrl, { signal: ac.signal, redirect: "follow" });
    clearTimeout(t);
    if (res.ok) {
      const body = await res.text();
      robotsOk = true;
      robotsBodySnippet = body.slice(0, 1200);
    }
  } catch {
    robotsOk = false;
  }

  const disallowsAdminPaths =
    robotsBodySnippet.includes("Disallow: /admin") || robotsBodySnippet.includes("disallow: /admin");

  return {
    origin,
    scannedAt,
    sitemapUrl,
    sitemapOk,
    sitemapUrlCount,
    sitemapSampleUrls,
    robotsUrl,
    robotsOk,
    robotsBodySnippet,
    disallowsAdminPaths,
  };
}
