import type { PageAnalysis } from "./pageAnalysis.js";
import { describe, expect, it } from "vitest";
import { computeSeoScores, overallScore } from "./seoScore.js";

function baseAnalysis(over: Partial<PageAnalysis> = {}): PageAnalysis {
  return {
    title: "Good title length for seo scoring example page",
    metaDescription:
      "This meta description is intentionally written to be between one hundred twenty and one hundred sixty characters for scoring.",
    metaRobots: "",
    canonicalHref: "https://example.com/",
    openGraph: { "og:title": "t", "og:description": "d", "og:url": "u" },
    twitter: {},
    h1: ["Single H1"],
    h2: ["A", "B"],
    h3: ["C"],
    internalLinks: ["https://example.com/other"],
    externalLinks: ["https://other.example/"],
    imagesMissingAlt: 0,
    imagesTotal: 2,
    wordCount: 650,
    bodyText: "word ".repeat(650),
    schemaTypes: ["SoftwareApplication"],
    jsonLdRawCount: 1,
    viewportPresent: true,
    charsetMeta: true,
    ...over,
  };
}

describe("computeSeoScores", () => {
  it("scores healthy pages highly overall", () => {
    const categories = computeSeoScores(baseAnalysis(), {
      statusCode: 200,
      isIndexable: true,
      brokenLinks: [],
      duplicateTitle: false,
      duplicateMeta: false,
    });
    const overall = overallScore(categories);
    expect(overall).toBeGreaterThanOrEqual(55);
    expect(categories.metadata).toBeGreaterThanOrEqual(40);
  });
});
