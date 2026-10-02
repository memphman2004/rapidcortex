import type { PageAnalysis } from "./pageAnalysis.js";
import type { SeoCategoryScores } from "rapid-cortex-shared";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type ScoreContext = {
  statusCode: number;
  isIndexable: boolean;
  brokenLinks: string[];
  duplicateTitle: boolean;
  duplicateMeta: boolean;
};

/** Deterministic 0–100 category scores and weighted overall score. */
export function computeSeoScores(analysis: PageAnalysis, ctx: ScoreContext): SeoCategoryScores {
  let metadata = 55;
  if (analysis.title.length >= 25 && analysis.title.length <= 70) metadata += 20;
  else if (analysis.title.length > 0) metadata += 8;
  if (analysis.metaDescription.length >= 110 && analysis.metaDescription.length <= 180) metadata += 15;
  else if (analysis.metaDescription.length > 0) metadata += 8;
  if (Object.keys(analysis.openGraph).length >= 3) metadata += 10;
  metadata = clamp(metadata);

  let headings = 55;
  if (analysis.h1.length === 1) headings += 25;
  else if (analysis.h1.length === 0) headings -= 25;
  else headings -= 10;
  if (analysis.h2.length >= 2) headings += 12;
  if (analysis.h3.length >= 1) headings += 8;
  headings = clamp(headings);

  let contentQuality = 50;
  if (analysis.wordCount >= 600) contentQuality += 35;
  else if (analysis.wordCount >= 300) contentQuality += 22;
  else if (analysis.wordCount >= 120) contentQuality += 10;
  contentQuality = clamp(contentQuality);

  let technicalSeo = 55;
  if (ctx.statusCode >= 200 && ctx.statusCode < 400) technicalSeo += 15;
  if (analysis.canonicalHref) technicalSeo += 12;
  if (ctx.isIndexable) technicalSeo += 12;
  if (analysis.viewportPresent) technicalSeo += 6;
  technicalSeo = clamp(technicalSeo);

  let links = 70;
  const broken = ctx.brokenLinks.length;
  links -= Math.min(40, broken * 8);
  const totalLinks = analysis.internalLinks.length + analysis.externalLinks.length;
  if (totalLinks >= 5) links += 10;
  links = clamp(links);

  let images = 75;
  if (analysis.imagesTotal > 0) {
    const missingRatio = analysis.imagesMissingAlt / analysis.imagesTotal;
    images -= Math.round(missingRatio * 55);
  }
  images = clamp(images);

  let schema = analysis.schemaTypes.length > 0 ? 82 : 38;
  if (analysis.jsonLdRawCount > 1) schema += 8;
  schema = clamp(schema);

  const performanceReadiness = analysis.viewportPresent && analysis.charsetMeta ? 78 : 62;

  return {
    metadata: clamp(metadata),
    headings: clamp(headings),
    contentQuality: clamp(contentQuality),
    technicalSeo: clamp(technicalSeo),
    links: clamp(links),
    images: clamp(images),
    schema: clamp(schema),
    performanceReadiness: clamp(performanceReadiness),
  };
}

export function overallScore(categories: SeoCategoryScores): number {
  const w = {
    metadata: 0.2,
    headings: 0.1,
    contentQuality: 0.15,
    technicalSeo: 0.2,
    links: 0.1,
    images: 0.1,
    schema: 0.1,
    performanceReadiness: 0.05,
  };
  let sum = 0;
  sum += categories.metadata * w.metadata;
  sum += categories.headings * w.headings;
  sum += categories.contentQuality * w.contentQuality;
  sum += categories.technicalSeo * w.technicalSeo;
  sum += categories.links * w.links;
  sum += categories.images * w.images;
  sum += categories.schema * w.schema;
  sum += categories.performanceReadiness * w.performanceReadiness;
  return clamp(sum);
}
