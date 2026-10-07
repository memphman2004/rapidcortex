import type { PageAnalysis } from "./pageAnalysis.js";

export type KeywordPlacement = {
  keyword: string;
  inTitle: boolean;
  inMeta: boolean;
  inH1: boolean;
  inHeadings: boolean;
  inBody: boolean;
  inAlt: boolean;
  inUrl: boolean;
  densityPercent: number;
  occurrences: number;
};

function normalizeKeyword(k: string): string {
  return k.trim().toLowerCase();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let i = 0;
  let c = 0;
  while (i < haystack.length) {
    const idx = haystack.indexOf(needle, i);
    if (idx === -1) break;
    c += 1;
    i = idx + needle.length;
  }
  return c;
}

export function analyzeKeywords(url: string, analysis: PageAnalysis, keywords: string[]): KeywordPlacement[] {
  const bodyLower = analysis.bodyText.toLowerCase();
  const urlLower = url.toLowerCase();
  const titleLower = analysis.title.toLowerCase();
  const metaLower = analysis.metaDescription.toLowerCase();
  const h1Blob = analysis.h1.join(" ").toLowerCase();
  const headingsBlob = [...analysis.h1, ...analysis.h2, ...analysis.h3].join(" ").toLowerCase();
  const words = bodyLower.split(/\s+/).filter(Boolean);
  const denom = Math.max(1, words.length);

  const out: KeywordPlacement[] = [];
  for (const raw of keywords) {
    const keyword = normalizeKeyword(raw);
    if (!keyword) continue;
    const occurrences = countOccurrences(bodyLower, keyword);
    const densityPercent = (occurrences / denom) * 100;
    out.push({
      keyword: raw.trim(),
      inTitle: titleLower.includes(keyword),
      inMeta: metaLower.includes(keyword),
      inH1: h1Blob.includes(keyword),
      inHeadings: headingsBlob.includes(keyword),
      inBody: bodyLower.includes(keyword),
      inAlt: false,
      inUrl: urlLower.includes(keyword.replace(/\s+/g, "-")) || urlLower.includes(encodeURIComponent(keyword)),
      densityPercent: Math.round(densityPercent * 100) / 100,
      occurrences,
    });
  }
  return out;
}

export type KeywordSuggestions = {
  titleOptions: string[];
  metaOptions: string[];
  h1Ideas: string[];
  internalLinkIdeas: string[];
  faqIdeas: string[];
  contentIdeas: string[];
};

export function buildKeywordSuggestions(
  url: string,
  analysis: PageAnalysis,
  placements: KeywordPlacement[],
): KeywordSuggestions {
  const primary = placements[0]?.keyword ?? "your primary keyword";
  const brand = "Rapid Cortex";
  return {
    titleOptions: [
      `${primary} | ${brand}`,
      `${brand} — ${primary}`,
      `${primary}: capabilities, integrations, and rollout`,
    ],
    metaOptions: [
      `Learn how ${brand} supports ${primary.toLowerCase()} with secure workflows, CAD-aware integrations, and measurable dispatcher outcomes.`,
      `Explore ${primary.toLowerCase()} with ${brand}: implementation guidance, governance, and operational safeguards for public safety agencies.`,
    ],
    h1Ideas: [
      `${primary} for emergency communications`,
      `A practical guide to ${primary.toLowerCase()}`,
    ],
    internalLinkIdeas: [
      `Link from your agency overview to this page using anchor text that contains “${primary.toLowerCase()}”.`,
      `Add a contextual link from related product pages (pricing, security, integrations) to reinforce topical relevance.`,
    ],
    faqIdeas: [
      `What does ${primary.toLowerCase()} include for my agency?`,
      `How does ${brand} implement ${primary.toLowerCase()} with least-privilege access and audit trails?`,
    ],
    contentIdeas: [
      `Publish a short case study showing before/after KPIs tied to ${primary.toLowerCase()}.`,
      `Add a comparison section that maps legacy workflows to ${brand} capabilities around ${primary.toLowerCase()}.`,
    ],
  };
}
