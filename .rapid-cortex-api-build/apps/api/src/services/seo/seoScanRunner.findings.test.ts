import { analyzeHtml } from "./pageAnalysis.js";
import { describe, expect, it } from "vitest";
import { buildSeoFindings } from "./seoScanRunner.js";
import type { SeoCategoryScores } from "rapid-cortex-shared";

describe("buildSeoFindings", () => {
  it("flags missing metadata", () => {
    const html = `<html><head><title></title></head><body><p>hi</p></body></html>`;
    const analysis = analyzeHtml(html, "https://example.com/a");
    const categories: SeoCategoryScores = {
      metadata: 20,
      headings: 40,
      contentQuality: 30,
      technicalSeo: 40,
      links: 50,
      images: 70,
      schema: 30,
      performanceReadiness: 60,
    };
    const findings = buildSeoFindings({
      analysis,
      ctx: {
        statusCode: 200,
        isIndexable: true,
        brokenLinks: [],
        duplicateTitle: false,
        duplicateMeta: false,
      },
      categories,
      inSitemap: null,
    });
    const types = new Set(findings.map((f) => f.issueType));
    expect(types.has("missing_title")).toBe(true);
    expect(types.has("missing_meta_description")).toBe(true);
  });

  it("creates issues for broken links", () => {
    const meta = "x".repeat(130);
    const html = `<html><head><title>T</title><meta name="description" content="${meta}"/></head>
<body><h1>H</h1><p>${"word ".repeat(400)}</p></body></html>`;
    const analysis = analyzeHtml(html, "https://example.com/");
    const categories: SeoCategoryScores = {
      metadata: 80,
      headings: 80,
      contentQuality: 80,
      technicalSeo: 80,
      links: 40,
      images: 80,
      schema: 80,
      performanceReadiness: 80,
    };
    const broken = ["https://example.com/missing"];
    const findings = buildSeoFindings({
      analysis,
      ctx: {
        statusCode: 200,
        isIndexable: true,
        brokenLinks: broken,
        duplicateTitle: false,
        duplicateMeta: false,
      },
      categories,
      inSitemap: true,
    });
    expect(findings.some((f) => f.issueType === "broken_link")).toBe(true);
  });
});
