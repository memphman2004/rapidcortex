/**
 * Attach two-score + evidence + taxonomy fields without replacing legacy fitScore.
 * Collectors stay unchanged; process-signal / enqueue / manual create call this.
 */

import {
  classifyTaxonomy,
  extractKeywordExcerpt,
  pipelineFitLabelFromScore,
  recommendedActionFromStage,
  scoreFit,
  scoreSignal,
  scoreSourceType,
  sourceDomainFromUrl,
  type RapidIqPipelineSignal,
  type RapidIqProcurementStage,
} from "rapid-cortex-shared";

export function applySignalIntelligence(input: {
  hay: string;
  sourceId: string;
  sourceUrl: string;
  signalDate: string;
  agencyType?: string;
  excerpt?: string;
  sourceTitle?: string;
  documentDate?: string;
  procurementStage?: RapidIqProcurementStage;
  relatedSignalCount?: number;
  legacyExtractScore?: number;
}): Pick<
  RapidIqPipelineSignal,
  | "fitScore"
  | "fitLabel"
  | "buyingIntentScore"
  | "productFitScore"
  | "combinedScore"
  | "intentEvidence"
  | "fitEvidence"
  | "excerpt"
  | "sourceTitle"
  | "sourceDomain"
  | "retrievalDate"
  | "documentDate"
  | "taxonomyTags"
  | "recommendedAction"
> {
  const sourceType = scoreSourceType(input.sourceId);
  const scores = scoreSignal(input.hay, sourceType, {
    sourceUrl: input.sourceUrl,
    signalDate: input.signalDate,
    agencyType: input.agencyType,
    relatedSignalCount: input.relatedSignalCount,
  });
  const keywordScore = scoreFit(input.hay, sourceType);
  let combined = Math.max(scores.combinedScore, input.legacyExtractScore ?? 0, 0);
  if (input.sourceId === "911-gov" || input.sourceId === "fcc-reports") {
    combined = Math.min(100, Math.max(combined, 70));
  }
  combined = Math.min(100, Math.max(0, Math.round(combined)));
  const fitScore = Math.min(100, Math.max(combined, keywordScore));

  return {
    fitScore,
    fitLabel: pipelineFitLabelFromScore(fitScore),
    buyingIntentScore: scores.buyingIntentScore,
    productFitScore: scores.productFitScore,
    combinedScore: combined,
    intentEvidence: scores.intentEvidence,
    fitEvidence: scores.fitEvidence,
    excerpt: (input.excerpt?.trim() || extractKeywordExcerpt(input.hay)).slice(0, 500),
    sourceTitle: input.sourceTitle,
    sourceDomain: sourceDomainFromUrl(input.sourceUrl) || undefined,
    retrievalDate: new Date().toISOString(),
    documentDate: input.documentDate,
    taxonomyTags: classifyTaxonomy(input.hay).slice(0, 40),
    recommendedAction: recommendedActionFromStage(input.procurementStage, scores.buyingIntentScore),
  };
}
