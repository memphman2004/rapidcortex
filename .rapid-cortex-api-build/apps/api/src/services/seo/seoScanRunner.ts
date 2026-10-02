import type { SeoCategoryScores, SeoIssueSeverity, SeoScanRecord, SeoScanStatus } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import type { SeoIntelligenceRepository } from "../../repositories/seoIntelligenceRepository.js";
import { fetchHtmlWithLimits } from "./fetchPage.js";
import { analyzeHtml } from "./pageAnalysis.js";
import { assertSafeFetchUrl } from "./ssrfGuard.js";
import { computeSeoScores, overallScore, type ScoreContext } from "./seoScore.js";

export type SeoFinding = {
  severity: SeoIssueSeverity;
  issueType: string;
  description: string;
  recommendation: string;
};

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMeta(m: string): string {
  return m.trim().toLowerCase().replace(/\s+/g, " ");
}

function isIndexable(analysis: { metaRobots: string }, headers: Record<string, string>): boolean {
  const xr = (headers["x-robots-tag"] ?? "").toLowerCase();
  const mr = analysis.metaRobots.toLowerCase();
  if (mr.includes("noindex")) return false;
  if (xr.includes("noindex")) return false;
  return true;
}

async function checkBrokenLinks(urls: string[], limit: number): Promise<string[]> {
  const broken: string[] = [];
  const uniq = [...new Set(urls)].slice(0, limit);
  for (const u of uniq) {
    try {
      await assertSafeFetchUrl(u);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      try {
        const res = await fetch(u, {
          method: "HEAD",
          redirect: "follow",
          signal: ac.signal,
          headers: { "User-Agent": "RapidCortex-CortexSeoBot/1.0" },
        });
        clearTimeout(timer);
        if (res.status >= 400) broken.push(u);
      } catch {
        clearTimeout(timer);
        try {
          const ac2 = new AbortController();
          const t2 = setTimeout(() => ac2.abort(), 8000);
          const res2 = await fetch(u, {
            method: "GET",
            redirect: "follow",
            signal: ac2.signal,
            headers: {
              "User-Agent": "RapidCortex-CortexSeoBot/1.0",
              Range: "bytes=0-0",
            },
          });
          clearTimeout(t2);
          if (res2.status >= 400) broken.push(u);
        } catch {
          broken.push(u);
        }
      }
    } catch {
      broken.push(u);
    }
  }
  return broken;
}

/** Exported for unit tests — deterministic issue generation from analysis + score context. */
export function buildSeoFindings(params: {
  analysis: ReturnType<typeof analyzeHtml>;
  ctx: ScoreContext;
  categories: SeoCategoryScores;
  inSitemap: boolean | null;
}): SeoFinding[] {
  const findings: SeoFinding[] = [];
  const { analysis, ctx, categories } = params;

  if (!analysis.title) {
    findings.push({
      severity: "CRITICAL",
      issueType: "missing_title",
      description: "The page has no <title> content.",
      recommendation: "Add a concise title (typically 30–60 characters) that reflects the page intent.",
    });
  }
  if (!analysis.metaDescription) {
    findings.push({
      severity: "HIGH",
      issueType: "missing_meta_description",
      description: "Meta description is missing.",
      recommendation: "Add a unique meta description (~120–160 characters) aligned to search intent.",
    });
  }
  if (analysis.h1.length === 0) {
    findings.push({
      severity: "HIGH",
      issueType: "missing_h1",
      description: "No H1 heading detected.",
      recommendation: "Use exactly one descriptive H1 aligned with the primary topic.",
    });
  } else if (analysis.h1.length > 1) {
    findings.push({
      severity: "MEDIUM",
      issueType: "multiple_h1",
      description: "Multiple H1 headings detected.",
      recommendation: "Consolidate to a single H1; use H2/H3 for structure.",
    });
  }

  if (!analysis.canonicalHref) {
    findings.push({
      severity: "MEDIUM",
      issueType: "missing_canonical",
      description: "No canonical link tag found.",
      recommendation: "Add rel=canonical to reduce duplicate URL variants.",
    });
  }

  if (analysis.imagesTotal > 0 && analysis.imagesMissingAlt / analysis.imagesTotal > 0.25) {
    findings.push({
      severity: "MEDIUM",
      issueType: "images_missing_alt",
      description: "Several images are missing alt text.",
      recommendation: "Add concise alt text for meaningful images; use empty alt only for decorative images.",
    });
  }

  if (analysis.schemaTypes.length === 0) {
    findings.push({
      severity: "LOW",
      issueType: "missing_json_ld",
      description: "No JSON-LD structured data detected.",
      recommendation: "Add relevant schema (FAQ, Organization, SoftwareApplication) using JSON-LD.",
    });
  }

  if (!ctx.isIndexable) {
    findings.push({
      severity: "HIGH",
      issueType: "not_indexable",
      description: "Page signals noindex via robots meta or X-Robots-Tag.",
      recommendation: "If this page should rank, remove noindex unless intentionally blocking search.",
    });
  }

  if (ctx.statusCode >= 400) {
    findings.push({
      severity: "CRITICAL",
      issueType: "http_error",
      description: `Non-success HTTP status (${ctx.statusCode}).`,
      recommendation: "Fix server availability or redirects so crawlers receive 200 for indexable pages.",
    });
  }

  for (const u of ctx.brokenLinks.slice(0, 10)) {
    findings.push({
      severity: "HIGH",
      issueType: "broken_link",
      description: `Broken or unreachable link: ${u}`,
      recommendation: "Update or remove the link; verify redirects for moved pages.",
    });
  }

  if (ctx.duplicateTitle) {
    findings.push({
      severity: "HIGH",
      issueType: "duplicate_title",
      description: "Another scanned page shares the same title.",
      recommendation: "Make titles unique per URL to avoid SERP duplication issues.",
    });
  }
  if (ctx.duplicateMeta) {
    findings.push({
      severity: "MEDIUM",
      issueType: "duplicate_meta_description",
      description: "Another scanned page shares the same meta description.",
      recommendation: "Tailor meta descriptions per page for clearer snippets.",
    });
  }

  if (params.inSitemap === false) {
    findings.push({
      severity: "LOW",
      issueType: "sitemap_presence",
      description: "URL was not found in the crawled sitemap.xml locations list.",
      recommendation: "Ensure important URLs are listed in sitemap.xml or intentional exclusions are documented.",
    });
  }

  if (categories.contentQuality < 55) {
    findings.push({
      severity: "MEDIUM",
      issueType: "thin_content",
      description: "Word count suggests thin content relative to competitive queries.",
      recommendation: "Expand with helpful sections, FAQs, and proof points unique to this page.",
    });
  }

  return findings;
}

function quickWins(findings: SeoFinding[]): string[] {
  const wins: string[] = [];
  for (const f of findings) {
    if (f.issueType === "missing_meta_description") wins.push("Add a meta description aligned to primary intent.");
    if (f.issueType === "missing_title") wins.push("Add a descriptive title tag.");
    if (f.issueType === "missing_canonical") wins.push("Add a canonical URL.");
    if (f.issueType === "missing_json_ld") wins.push("Add Organization or FAQ JSON-LD.");
  }
  return [...new Set(wins)].slice(0, 8);
}

export async function runPageSeoScan(opts: {
  agencyId: string;
  url: string;
  keywords?: string[];
  schedule?: SeoScanRecord["scanSchedule"];
  repo: SeoIntelligenceRepository;
}): Promise<SeoScanRecord> {
  const scanId = makeId("seo_scan");
  const now = new Date().toISOString();
  let scanStatus: SeoScanStatus = "running";

  const safeUrl = await assertSafeFetchUrl(opts.url);
  const target = safeUrl.href;

  let statusCode = 0;
  let html = "";
  let finalUrl = target;
  let headers: Record<string, string> = {};

  try {
    const fetched = await fetchHtmlWithLimits(target);
    statusCode = fetched.statusCode;
    html = fetched.html;
    finalUrl = fetched.finalUrl;
    headers = fetched.responseHeaders;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    scanStatus = "failed";
    const failedRecord: SeoScanRecord = {
      id: scanId,
      agencyId: opts.agencyId,
      url: target,
      pageTitle: "",
      metaDescription: "",
      h1: "",
      score: 0,
      categoryScores: {
        metadata: 0,
        headings: 0,
        contentQuality: 0,
        technicalSeo: 0,
        links: 0,
        images: 0,
        schema: 0,
        performanceReadiness: 0,
      },
      issues: [],
      recommendations: [msg === "PAGE_TOO_LARGE" ? "Page exceeded configured byte limit." : "Fetch failed."],
      keywords: opts.keywords,
      schemaDetected: [],
      brokenLinks: [],
      scanStatus,
      scanSchedule: opts.schedule ?? "manual",
      createdAt: now,
      updatedAt: now,
    };
    await opts.repo.putScan(opts.agencyId, failedRecord);
    return failedRecord;
  }

  const analysis = analyzeHtml(html, finalUrl);
  const idx = isIndexable(analysis, headers);

  const recent = await opts.repo.listScans(opts.agencyId, 80);
  const dupTitle = recent.some(
    (s) => s.id !== scanId && normalizeTitle(s.pageTitle) === normalizeTitle(analysis.title) && analysis.title,
  );
  const dupMeta = recent.some(
    (s) =>
      s.id !== scanId &&
      analysis.metaDescription &&
      normalizeMeta(s.metaDescription) === normalizeMeta(analysis.metaDescription),
  );

  const linkPool = [...analysis.internalLinks, ...analysis.externalLinks];
  const broken = await checkBrokenLinks(linkPool, env.seoMaxBrokenLinkChecks);

  let inSitemap: boolean | null = null;
  try {
    const origin = new URL(finalUrl).origin;
    const smUrl = new URL("/sitemap.xml", origin).href;
    await assertSafeFetchUrl(smUrl);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), env.seoFetchTimeoutMs);
    const res = await fetch(smUrl, { signal: ac.signal });
    clearTimeout(t);
    if (res.ok) {
      const xml = await res.text();
      inSitemap = xml.includes(finalUrl);
    }
  } catch {
    inSitemap = null;
  }

  const ctx: ScoreContext = {
    statusCode,
    isIndexable: idx,
    brokenLinks: broken,
    duplicateTitle: dupTitle,
    duplicateMeta: dupMeta,
  };

  const categories = computeSeoScores(analysis, ctx);
  const score = overallScore(categories);

  const findings = buildSeoFindings({
    analysis,
    ctx: { ...ctx, brokenLinks: broken },
    categories,
    inSitemap,
  });

  const critical = findings.filter((f) => f.severity === "CRITICAL").map((f) => f.description);

  const recommendations = [
    ...quickWins(findings),
    ...(critical.length ? [`Critical: ${critical.join(" · ")}`] : []),
    "Review heading hierarchy (H2/H3) for scan-friendly structure.",
    ...(idx ? [] : ["Validate indexability expectations before requesting search visibility."]),
  ];

  const issuesSerialized = findings.map((f) => ({
    severity: f.severity,
    issueType: f.issueType,
    description: f.description,
    recommendation: f.recommendation,
  }));

  scanStatus = "completed";
  const record: SeoScanRecord = {
    id: scanId,
    agencyId: opts.agencyId,
    url: finalUrl,
    pageTitle: analysis.title,
    metaDescription: analysis.metaDescription,
    h1: analysis.h1[0] ?? "",
    score,
    categoryScores: categories,
    issues: issuesSerialized,
    recommendations: [...new Set(recommendations)].slice(0, 25),
    keywords: opts.keywords,
    schemaDetected: [...new Set(analysis.schemaTypes)],
    brokenLinks: broken,
    scanStatus,
    scanSchedule: opts.schedule ?? "manual",
    createdAt: now,
    updatedAt: now,
  };

  await opts.repo.putScan(opts.agencyId, record);

  for (const f of findings) {
    const issueId = makeId("seo_issue");
    await opts.repo.putIssue(opts.agencyId, {
      id: issueId,
      agencyId: opts.agencyId,
      url: finalUrl,
      severity: f.severity,
      issueType: f.issueType,
      description: f.description,
      recommendation: f.recommendation,
      status: "OPEN",
      scanId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return record;
}
