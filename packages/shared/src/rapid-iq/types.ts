/**
 * Rapid IQ procurement-pipeline types (master prompt).
 * Opportunity-linked `RapidIqSignal` lives in `./schemas.ts` — do not collide.
 * These aliases match the pipeline Zod schemas in `./pipeline-schemas.ts`.
 */

export {
  RAPID_IQ_PIPELINE_SOURCE_IDS as RAPID_IQ_SOURCE_IDS,
  type RapidIqPipelineSourceId as RapidIqSourceId,
  RAPID_IQ_PIPELINE_SIGNAL_STATUSES as RAPID_IQ_SIGNAL_STATUSES,
  type RapidIqPipelineSignalStatus as RapidIqSignalStatus,
  RAPID_IQ_PIPELINE_FIT_LABELS as RAPID_IQ_FIT_LABELS,
  type RapidIqPipelineFitLabel as RapidIqFitLabel,
  RAPID_IQ_PIPELINE_PROCUREMENT_TYPES as RAPID_IQ_PROCUREMENT_TYPES,
  type RapidIqPipelineProcurementType as RapidIqProcurementType,
  type RapidIqPipelineContactHint as RapidIqContactHint,
  type RapidIqPipelineRawSignal as RapidIqRawSignal,
  type RapidIqPipelineExtraction as RapidIqExtraction,
  type PatchRapidIqPipelineSignalBody as PatchRapidIqSignalBody,
  type PushRapidIqPipelineToCrmBody as PushRapidIqToCrmBody,
  RAPID_IQ_PIPELINE_SOURCE_LABELS as RAPID_IQ_SOURCE_LABELS,
  RAPID_IQ_PIPELINE_FIT_SCORE_THRESHOLDS as RAPID_IQ_FIT_SCORE_THRESHOLDS,
  pipelineFitLabelFromScore as fitLabelFromScore,
} from "./pipeline-schemas.js";
