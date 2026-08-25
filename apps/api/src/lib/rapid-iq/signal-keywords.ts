/**
 * Re-export the canonical Rapid IQ keyword library from shared.
 * Callers may also import from `rapid-cortex-shared`.
 */
export {
  KEYWORDS,
  GRANTS_GOV_SEARCH_KEYWORDS,
  OPENSTATES_BILL_QUERIES,
  US_STATE_CODES,
  classifyProcurementStage,
  scoreFit,
  scoreSourceType,
  isRelevantSignalText,
  keywordMatches,
  inferCompetitorName,
  PROCUREMENT_STAGE_LABELS,
  scoreSignal,
  classifyTaxonomy,
  extractKeywordExcerpt,
} from "rapid-cortex-shared";
